package controllers

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/google/uuid"
)

// exportAPIError carries the HTTP status/message/code that should be sent
// back to the client when building the attendance report fails.
type exportAPIError struct {
	Status  int
	Message string
	Code    string
}

func (e *exportAPIError) Error() string { return e.Message }

// weekdayOrder fixes the natural Monday-first weekly ordering used to build
// the work-day pattern (Senin..Minggu), regardless of what order the
// selected weekdays were supplied in.
var weekdayOrder = []time.Weekday{
	time.Monday, time.Tuesday, time.Wednesday, time.Thursday,
	time.Friday, time.Saturday, time.Sunday,
}

// weekdayLabels maps Go's time.Weekday to the Indonesian day-name used in
// the report header row.
var weekdayLabels = map[time.Weekday]string{
	time.Monday:    "Senin",
	time.Tuesday:   "Selasa",
	time.Wednesday: "Rabu",
	time.Thursday:  "Kamis",
	time.Friday:    "Jumat",
	time.Saturday:  "Sabtu",
	time.Sunday:    "Minggu",
}

// defaultWorkDays is Senin-Sabtu, the recap's historical/default working
// week, used whenever the request doesn't specify a custom `work_days` set.
var defaultWorkDays = []time.Weekday{
	time.Monday, time.Tuesday, time.Wednesday, time.Thursday, time.Friday, time.Saturday,
}

// parseWorkDays parses a comma-separated list of JS-style weekday numbers
// (0 = Minggu/Sunday .. 6 = Sabtu/Saturday -- the same convention
// Date.getDay() uses in the frontend) into a de-duplicated, Monday-first
// ordered slice of weekdays. Falls back to defaultWorkDays (Senin-Sabtu)
// when the raw string is empty or nothing valid is found in it.
func parseWorkDays(raw string) []time.Weekday {
	if strings.TrimSpace(raw) == "" {
		return defaultWorkDays
	}
	selected := make(map[time.Weekday]bool)
	for _, part := range strings.Split(raw, ",") {
		n, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil || n < 0 || n > 6 {
			continue
		}
		selected[time.Weekday(n)] = true
	}
	if len(selected) == 0 {
		return defaultWorkDays
	}
	ordered := make([]time.Weekday, 0, len(selected))
	for _, wd := range weekdayOrder {
		if selected[wd] {
			ordered = append(ordered, wd)
		}
	}
	return ordered
}

// buildExportParams holds the parsed/validated query parameters shared by
// both the PDF and XLSX export endpoints.
type buildExportParams struct {
	StartDate  time.Time
	EndDate    time.Time
	StartStr   string
	EndStr     string
	DUName     string
	DUAddress  string
	StudentIDs []uuid.UUID
	// WorkDays is the ordered (Monday-first) set of weekdays treated as
	// working days for this recap -- e.g. Senin-Sabtu by default, but
	// fully configurable from the frontend's day-of-week picker. The
	// report's block width is always 2x this set's length (two weeks per
	// block), which is what makes the number of day-columns per row
	// flexible (8, 10, 12, ... days) instead of a hardcoded 12.
	WorkDays []time.Weekday
}

// parseExportParams parses and validates the raw query string values shared
// by both export endpoints.
func parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr, workDaysStr string) (*buildExportParams, *exportAPIError) {
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return nil, &exportAPIError{400, "Invalid start_date format", "INVALID_QUERY"}
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return nil, &exportAPIError{400, "Invalid end_date format", "INVALID_QUERY"}
	}

	if endDate.Before(startDate) {
		return nil, &exportAPIError{400, "end_date must not be before start_date", "INVALID_QUERY"}
	}

	var studentIDs []uuid.UUID
	if studentIDsStr != "" {
		for _, idStr := range strings.Split(studentIDsStr, ",") {
			id, err := uuid.Parse(strings.TrimSpace(idStr))
			if err != nil {
				continue
			}
			studentIDs = append(studentIDs, id)
		}
	}

	return &buildExportParams{
		StartDate:  startDate,
		EndDate:    endDate,
		StartStr:   startDateStr,
		EndStr:     endDateStr,
		DUName:     duName,
		DUAddress:  duAddress,
		StudentIDs: studentIDs,
		WorkDays:   parseWorkDays(workDaysStr),
	}, nil
}

// attendanceMark holds what happened on a given calendar day for a given
// student, derived from the raw attendance/absence records.
type attendanceMark struct {
	Hadir          bool
	ApprovedOption string // "sick" or "permission", only set when SignStatus == "allow"
}

// buildAttendanceDoc implements the shared data-assembly algorithm (see the
// export backend contract, section 2) used by both the PDF and XLSX
// exporters, so the two outputs are always structurally identical.
func (ctrl *AdminController) buildAttendanceDoc(p *buildExportParams) (*models.PDFTemplateData, *exportAPIError) {
	// 1. Resolve students: explicit student_ids, or every non-admin user.
	var students []models.User
	query := ctrl.DB.Where("type != ?", "admin")
	if len(p.StudentIDs) > 0 {
		query = query.Where("id IN ?", p.StudentIDs)
	}
	query.Order("nickname ASC").Find(&students)

	if len(students) == 0 {
		return nil, &exportAPIError{400, "No students found", "DATA_NOT_FOUND"}
	}

	studentIDList := make([]uuid.UUID, len(students))
	for i, s := range students {
		studentIDList[i] = s.ID
	}

	// Fetch every attendance/absence record inside the requested range only
	// -- anything outside [start_date, end_date] is blank by contract
	// regardless of what data exists, so there is no need to query further.
	var records []models.Attendance
	ctrl.DB.Where("user_id IN ?", studentIDList).
		Where("created_at >= ? AND created_at < ?", p.StartDate, p.EndDate.AddDate(0, 0, 1)).
		Find(&records)

	index := make(map[uuid.UUID]map[string]attendanceMark)
	// dayHasRecord tracks, per calendar date, whether *any* student in the
	// recap has *any* record at all that day (attendance or absence,
	// approved or not). A date with no record from anyone is treated as a
	// non-school day (holiday/libur) rather than "everyone was Alpa".
	dayHasRecord := make(map[string]bool)
	for _, rec := range records {
		if index[rec.UserID] == nil {
			index[rec.UserID] = make(map[string]attendanceMark)
		}
		dateKey := rec.CreatedAt.Format("2006-01-02")
		dayHasRecord[dateKey] = true
		entry := index[rec.UserID][dateKey]

		switch rec.Type {
		case "attendance":
			entry.Hadir = true
		case "absence":
			if rec.SignStatus != nil && *rec.SignStatus == "allow" && rec.Option != nil {
				entry.ApprovedOption = *rec.Option
			}
		}
		index[rec.UserID][dateKey] = entry
	}

	todayStr := time.Now().UTC().Format("2006-01-02")

	markFor := func(studentID uuid.UUID, d time.Time) string {
		dateStr := d.Format("2006-01-02")

		// Outside the requested range (including the wholly-out-of-range
		// padding block) is always blank.
		if dateStr < p.StartStr || dateStr > p.EndStr {
			return ""
		}
		// Future dates are never Alpa -- just blank.
		if dateStr > todayStr {
			return ""
		}
		// Nobody in the recap submitted anything that day (no attendance,
		// no absence) -- treat it as a day off (libur) rather than
		// defaulting every student to Alpa. Only once at least one student
		// has *some* record that day do the rest, still without a record,
		// get marked "A".
		if !dayHasRecord[dateStr] {
			return ""
		}

		mark := index[studentID][dateStr]
		if mark.Hadir {
			return "√"
		}
		switch mark.ApprovedOption {
		case "sick":
			return "S"
		case "permission":
			return "I"
		}
		// Past working day, someone else in the recap had activity, but
		// this student has no record and no approved absence -> Alpa.
		return "A"
	}

	// Work-day pattern (e.g. Senin..Sabtu), repeated twice per block. This
	// makes daysPerBlock (and the header row) fully derived from the
	// requested work-day set instead of a hardcoded 12.
	pattern := p.WorkDays
	if len(pattern) == 0 {
		pattern = defaultWorkDays
	}
	weekN := len(pattern)
	daysPerBlock := weekN * 2

	patternLabels := make([]string, weekN)
	for i, wd := range pattern {
		patternLabels[i] = weekdayLabels[wd]
	}
	hariLabel := make([]string, 0, daysPerBlock)
	hariLabel = append(hariLabel, patternLabels...)
	hariLabel = append(hariLabel, patternLabels...)

	isWorkDay := make(map[time.Weekday]bool, weekN)
	for _, wd := range pattern {
		isWorkDay[wd] = true
	}
	// indexInPattern maps a weekday to its 0-based column position within
	// a single week of the pattern (i.e. within the first of the block's
	// two weeks).
	indexInPattern := make(map[time.Weekday]int, weekN)
	for i, wd := range pattern {
		indexInPattern[wd] = i
	}

	// 2. Find the first working day (per the selected pattern, Minggu
	// skipped unless explicitly selected) >= start_date.
	firstWorkDay := p.StartDate
	for !isWorkDay[firstWorkDay.Weekday()] {
		firstWorkDay = firstWorkDay.AddDate(0, 0, 1)
	}
	// Column offset where the very first block should start filling data --
	// e.g. if the recap starts on a Rabu, the Senin/Selasa columns of the
	// first block are left entirely blank (no date, no marks) and the
	// first real date lands in the Rabu column, per the export contract.
	firstBlockOffset := indexInPattern[firstWorkDay.Weekday()]

	// Total selected working days inside [start_date, end_date] -- used to
	// size how many blocks are actually needed.
	workdayCount := 0
	for d := p.StartDate; !d.After(p.EndDate); d = d.AddDate(0, 0, 1) {
		if isWorkDay[d.Weekday()] {
			workdayCount++
		}
	}

	// 3-4. Total number of blocks: however many are needed to hold every
	// working day in range, given the first block has fewer usable columns
	// (daysPerBlock - firstBlockOffset) because of the leading blank
	// columns. No more rounding up to an even count / forcing a second,
	// entirely-empty filler block just to keep 2 tables per page -- a
	// short range that fully fits in the first block now produces exactly
	// one block/table.
	firstBlockCapacity := daysPerBlock - firstBlockOffset
	totalBlocks := 1
	if workdayCount > firstBlockCapacity {
		totalBlocks = 1 + int(math.Ceil(float64(workdayCount-firstBlockCapacity)/float64(daysPerBlock)))
	}

	cursor := firstWorkDay
	blocks := make([]models.PDFBlock, 0, totalBlocks)
	for b := 0; b < totalBlocks; b++ {
		offset := 0
		if b == 0 {
			offset = firstBlockOffset
		}

		// Columns before `offset` (only possible on the first block) stay
		// entirely blank: zero-value time.Time (never matched by markFor)
		// and "" in tanggalStrs.
		blockDays := make([]time.Time, daysPerBlock)
		tanggalStrs := make([]string, daysPerBlock)
		for i := offset; i < daysPerBlock; i++ {
			blockDays[i] = cursor
			tanggalStrs[i] = cursor.Format("02")
			cursor = cursor.AddDate(0, 0, 1)
			for !isWorkDay[cursor.Weekday()] {
				cursor = cursor.AddDate(0, 0, 1)
			}
		}

		// 6-7. Per student, per block: fill marks and reset S/I/A totals
		// from zero for this block only.
		siswaList := make([]models.PDFSiswa, 0, len(students))
		for _, st := range students {
			marks := make([]string, daysPerBlock)
			countS, countI, countA := 0, 0, 0
			for i := offset; i < daysPerBlock; i++ {
				m := markFor(st.ID, blockDays[i])
				marks[i] = m
				switch m {
				case "S":
					countS++
				case "I":
					countI++
				case "A":
					countA++
				}
			}
			siswaList = append(siswaList, models.PDFSiswa{
				Nama:  st.Nickname,
				Marks: marks,
				S:     countS,
				I:     countI,
				A:     countA,
			})
		}

		blocks = append(blocks, models.PDFBlock{
			HariLabel: hariLabel,
			Tanggal:   tanggalStrs,
			Siswa:     siswaList,
		})
	}

	// 5. Group blocks two-per-page. A page may end with a single block
	// when there's an odd number of blocks overall -- the bottom table is
	// simply omitted rather than padded with an empty filler block.
	pages := make([]models.PDFPage, 0, (len(blocks)+1)/2)
	for i := 0; i < len(blocks); i += 2 {
		page := models.PDFPage{
			NamaDUDI:   p.DUName,
			AlamatDUDI: p.DUAddress,
			Blocks:     []models.PDFBlock{blocks[i]},
		}
		if i+1 < len(blocks) {
			page.Blocks = append(page.Blocks, blocks[i+1])
		}
		pages = append(pages, page)
	}

	return &models.PDFTemplateData{Pages: pages}, nil
}
