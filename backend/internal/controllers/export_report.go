package controllers

import (
	"math"
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

// hariLabelConstant is the fixed "Senin, Selasa, ... x2" header row used by
// every block regardless of which weekday the block actually starts on (per
// the export contract: HariLabel is constant and never recomputed per block).
var hariLabelConstant = []string{
	"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
	"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
}

const daysPerBlock = 12

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
}

// parseExportParams parses and validates the raw query string values shared
// by both export endpoints.
func parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr string) (*buildExportParams, *exportAPIError) {
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
	for _, rec := range records {
		if index[rec.UserID] == nil {
			index[rec.UserID] = make(map[string]attendanceMark)
		}
		dateKey := rec.CreatedAt.Format("2006-01-02")
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
		// Past working day, no record and no approved absence -> Alpa.
		return "A"
	}

	// 2-3. Find the first working day (Mon-Sat, Sunday skipped) >= start_date,
	// then walk forward generating 12-working-day blocks. Continuing the
	// Mon-Sat pattern naturally carries a block's dates past end_date when
	// needed to fill all 12 columns.
	cursor := p.StartDate

	// 4. Total number of blocks = ceil(working days in range / 12), minimum
	// 1, rounded up to an even number so every page always has 2 full
	// tables (extra block is entirely out-of-range filler).
	workdayCount := 0
	for d := p.StartDate; !d.After(p.EndDate); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Sunday {
			workdayCount++
		}
	}
	totalBlocks := int(math.Ceil(float64(workdayCount) / float64(daysPerBlock)))
	if totalBlocks < 1 {
		totalBlocks = 1
	}
	if totalBlocks%2 != 0 {
		totalBlocks++
	}

	blocks := make([]models.PDFBlock, 0, totalBlocks)
	for b := 0; b < totalBlocks; b++ {
		blockDays := make([]time.Time, 0, daysPerBlock)
		for len(blockDays) < daysPerBlock {
			if cursor.Weekday() != time.Sunday {
				blockDays = append(blockDays, cursor)
			}
			cursor = cursor.AddDate(0, 0, 1)
		}

		tanggalStrs := make([]string, daysPerBlock)
		for i, d := range blockDays {
			tanggalStrs[i] = d.Format("02")
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
			HariLabel: hariLabelConstant,
			Tanggal:   tanggalStrs,
			Siswa:     siswaList,
		})
	}

	// 5. Group blocks two-per-page.
	pages := make([]models.PDFPage, 0, len(blocks)/2)
	for i := 0; i < len(blocks); i += 2 {
		pages = append(pages, models.PDFPage{
			NamaDUDI:   p.DUName,
			AlamatDUDI: p.DUAddress,
			Blocks:     []models.PDFBlock{blocks[i], blocks[i+1]},
		})
	}

	return &models.PDFTemplateData{Pages: pages}, nil
}