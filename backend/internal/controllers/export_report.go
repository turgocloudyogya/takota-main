package controllers

import (
	"math"
	"sort"
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

// defaultWorkingDays is used whenever the caller doesn't pass an explicit
// `working_days` query param, and reproduces the previous hard-coded
// behaviour (Senin-Sabtu, i.e. every day except Minggu/Sunday).
var defaultWorkingDays = []int{1, 2, 3, 4, 5, 6} // ISO weekday: Senin=1 .. Minggu=7

// dayNameID maps an ISO weekday number (Senin=1 .. Minggu=7) to its
// Indonesian name, used both to build each block's header row and to parse
// the `working_days` query param when it's given as day names instead of
// numbers.
var dayNameID = map[int]string{
	1: "Senin", 2: "Selasa", 3: "Rabu", 4: "Kamis", 5: "Jumat", 6: "Sabtu", 7: "Minggu",
}

var dayNameToISO = map[string]int{
	"senin": 1, "selasa": 2, "rabu": 3, "kamis": 4, "jumat": 5, "sabtu": 6, "minggu": 7,
}

// buildExportParams holds the parsed/validated query parameters shared by
// both the PDF and XLSX export endpoints.
type buildExportParams struct {
	StartDate   time.Time
	EndDate     time.Time
	StartStr    string
	EndStr      string
	DUName      string
	DUAddress   string
	StudentIDs  []uuid.UUID
	WorkingDays []int // sorted, deduped ISO weekday numbers (Senin=1..Minggu=7)
}

// parseWorkingDays parses the `working_days` query param into a sorted,
// deduped list of ISO weekday numbers (Senin=1..Minggu=7). Accepts either
// numbers ("1,2,3,4,5,6") or Indonesian day names ("senin,selasa,..."),
// case-insensitively, so the frontend can send whichever is convenient.
// An empty string falls back to defaultWorkingDays (Senin-Sabtu), keeping
// the previous fixed behaviour for any caller that doesn't opt in.
func parseWorkingDays(raw string) ([]int, *exportAPIError) {
	if strings.TrimSpace(raw) == "" {
		days := make([]int, len(defaultWorkingDays))
		copy(days, defaultWorkingDays)
		return days, nil
	}

	seen := make(map[int]bool)
	var days []int
	for _, part := range strings.Split(raw, ",") {
		token := strings.ToLower(strings.TrimSpace(part))
		if token == "" {
			continue
		}

		var iso int
		if n, err := strconv.Atoi(token); err == nil {
			iso = n
		} else if n, ok := dayNameToISO[token]; ok {
			iso = n
		} else {
			return nil, &exportAPIError{400, "Invalid working_days value: " + part, "INVALID_QUERY"}
		}

		if iso < 1 || iso > 7 {
			return nil, &exportAPIError{400, "working_days values must be between 1 (Senin) and 7 (Minggu)", "INVALID_QUERY"}
		}
		if !seen[iso] {
			seen[iso] = true
			days = append(days, iso)
		}
	}

	if len(days) == 0 {
		return nil, &exportAPIError{400, "At least one working day must be selected", "INVALID_QUERY"}
	}

	sort.Ints(days)
	return days, nil
}

// parseExportParams parses and validates the raw query string values shared
// by both export endpoints.
func parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr, workingDaysStr string) (*buildExportParams, *exportAPIError) {
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

	workingDays, apiErr := parseWorkingDays(workingDaysStr)
	if apiErr != nil {
		return nil, apiErr
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
		StartDate:   startDate,
		EndDate:     endDate,
		StartStr:    startDateStr,
		EndStr:      endDateStr,
		DUName:      duName,
		DUAddress:   duAddress,
		StudentIDs:  studentIDs,
		WorkingDays: workingDays,
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
	// dailyHadir tracks, per calendar date, whether *any* student in this
	// recap actually checked in ("hadir"). It's used below to tell a real
	// holiday/off-day (nobody came, because there was no session) apart
	// from an actual absence (some students came, this one didn't).
	dailyHadir := make(map[string]bool)
	for _, rec := range records {
		if index[rec.UserID] == nil {
			index[rec.UserID] = make(map[string]attendanceMark)
		}
		dateKey := rec.CreatedAt.Format("2006-01-02")
		entry := index[rec.UserID][dateKey]

		switch rec.Type {
		case "attendance":
			entry.Hadir = true
			dailyHadir[dateKey] = true
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
		// No record and no approved absence. If *nobody at all* checked in
		// that day, treat it as a day off (libur) instead of Alpa -- an
		// empty cell, not "A" -- since there's no evidence a session even
		// happened. Only mark "A" when at least one other student did
		// attend that day, meaning this student was the one who skipped.
		if !dailyHadir[dateStr] {
			return ""
		}
		return "A"
	}

	// 2-3. Each block's header row repeats the selected working days twice
	// (e.g. Senin..Sabtu, Senin..Sabtu for the default), so each block's
	// columns must line up with that same weekday grid -- not just be "the
	// next N working days" packed back-to-back starting from start_date.
	// Otherwise, whenever start_date doesn't fall on the first selected
	// weekday, column 0 gets mislabelled (e.g. start_date = a Tuesday still
	// written into the "Senin" column).
	//
	// Fix: anchor the grid to the earliest selected weekday, in the week
	// that contains start_date, and blank out (both date and marks) any
	// grid column that falls before start_date -- e.g. start_date on a
	// Wednesday blanks that week's Senin/Selasa columns and the recap
	// proper begins at the Rabu column, still carrying start_date's real
	// date number.
	workingDaySet := make(map[int]bool, len(p.WorkingDays))
	for _, wd := range p.WorkingDays {
		workingDaySet[wd] = true
	}
	isoWeekday := func(d time.Time) int {
		// Go's time.Weekday: Minggu=0..Sabtu=6. Convert to ISO: Senin=1..Minggu=7.
		wd := int(d.Weekday())
		if wd == 0 {
			return 7
		}
		return wd
	}
	isWorkingDay := func(d time.Time) bool {
		return workingDaySet[isoWeekday(d)]
	}

	daysPerBlock := len(p.WorkingDays) * 2

	// hariLabels repeats the selected days (in ISO/chronological order,
	// Senin..Minggu) twice, forming the fixed header row for every block.
	hariLabels := make([]string, 0, daysPerBlock)
	for cycle := 0; cycle < 2; cycle++ {
		for _, wd := range p.WorkingDays {
			hariLabels = append(hariLabels, dayNameID[wd])
		}
	}

	// Monday of the calendar week containing start_date, then scan forward
	// (at most 7 days) to the first selected working day -- this is always
	// found since WorkingDays is never empty.
	mondayOffset := (int(p.StartDate.Weekday()) + 6) % 7 // Senin=0 .. Minggu=6
	mondayOfWeek := p.StartDate.AddDate(0, 0, -mondayOffset)
	weekStart := mondayOfWeek
	for i := 0; i < 7; i++ {
		if isWorkingDay(weekStart) {
			break
		}
		weekStart = weekStart.AddDate(0, 0, 1)
	}
	cursor := weekStart

	// 4. Total number of blocks = ceil(grid working days from weekStart
	// through end_date / daysPerBlock), minimum 1. No longer forced to an
	// even number: a range that fits entirely in one block only ever
	// produces that one block/table, instead of always padding out a
	// second, entirely empty table on the same page.
	workdayCount := 0
	for d := weekStart; !d.After(p.EndDate); d = d.AddDate(0, 0, 1) {
		if isWorkingDay(d) {
			workdayCount++
		}
	}
	totalBlocks := int(math.Ceil(float64(workdayCount) / float64(daysPerBlock)))
	if totalBlocks < 1 {
		totalBlocks = 1
	}

	blocks := make([]models.PDFBlock, 0, totalBlocks)
	for b := 0; b < totalBlocks; b++ {
		blockDays := make([]time.Time, 0, daysPerBlock)
		for len(blockDays) < daysPerBlock {
			if isWorkingDay(cursor) {
				blockDays = append(blockDays, cursor)
			}
			cursor = cursor.AddDate(0, 0, 1)
		}

		// Columns that fall outside [start_date, end_date] -- i.e. the
		// leading Senin/Selasa-style blanks before start_date in the first
		// week, or trailing filler past end_date -- show neither a date
		// nor a mark. markFor() already blanks marks for these; do the same
		// for the displayed date number so the column reads as fully empty.
		tanggalStrs := make([]string, daysPerBlock)
		for i, d := range blockDays {
			if d.Before(p.StartDate) || d.After(p.EndDate) {
				tanggalStrs[i] = ""
			} else {
				tanggalStrs[i] = d.Format("02")
			}
		}

		// 6-7. Per student, per block: fill marks and reset S/I/A totals
		// from zero for this block only.
		siswaList := make([]models.PDFSiswa, 0, len(students))
		for _, st := range students {
			marks := make([]string, daysPerBlock)
			countS, countI, countA := 0, 0, 0
			for i, d := range blockDays {
				m := markFor(st.ID, d)
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
			HariLabel: hariLabels,
			Tanggal:   tanggalStrs,
			Siswa:     siswaList,
		})
	}

	// 5. Group blocks two-per-page. If the last page only has one block
	// left over (odd totalBlocks), it gets just that one table instead of
	// being padded with a second, empty one.
	pages := make([]models.PDFPage, 0, (len(blocks)+1)/2)
	for i := 0; i < len(blocks); i += 2 {
		pageBlocks := []models.PDFBlock{blocks[i]}
		if i+1 < len(blocks) {
			pageBlocks = append(pageBlocks, blocks[i+1])
		}
		pages = append(pages, models.PDFPage{
			NamaDUDI:   p.DUName,
			AlamatDUDI: p.DUAddress,
			Blocks:     pageBlocks,
		})
	}

	return &models.PDFTemplateData{Pages: pages}, nil
}
