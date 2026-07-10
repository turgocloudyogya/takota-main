package controllers

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ExportData struct {
	No              int
	Name            string
	Attendance      string
	Time            string
	Date            string
	AbsenceType     string
	AbsenceReason   string
}

// ExportAttendance exports attendance data to CSV
func (ctrl *AdminController) ExportAttendance(c *gin.Context) {
	month := c.Query("month")
	lang := c.Query("lang")

	if lang == "" {
		lang = "en"
	}

	// Validate language
	if lang != "en" && lang != "id" {
		utils.RespondError(c, http.StatusBadRequest, "Invalid query parameters", utils.ErrInvalidQuery)
		return
	}

	// Parse month
	var startDate, endDate time.Time
	if month != "" {
		monthNum := utils.GetMonthNumber(strings.ToLower(month))
		if monthNum == 0 {
			utils.RespondError(c, http.StatusBadRequest, "Invalid query parameters", utils.ErrInvalidQuery)
			return
		}
		year := time.Now().Year()
		startDate = time.Date(year, time.Month(monthNum), 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(0, 1, 0)
	} else {
		// Default to current month
		now := time.Now()
		startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		endDate = startDate.AddDate(0, 1, 0)
	}

	// Fetch attendance data
	var attendances []models.Attendance
	ctrl.DB.Where("created_at >= ? AND created_at < ?", startDate, endDate).
		Preload("User").
		Order("created_at ASC").
		Find(&attendances)

	// Prepare CSV data
	var exportData []ExportData
	for i, att := range attendances {
		data := ExportData{
			No:              i + 1,
			Name:            att.User.Nickname,
			Attendance:      att.Type,
			Time:            att.CreatedAt.Format("15:04:05"),
			Date:            att.CreatedAt.Format("2006-01-02"),
			AbsenceType:     "",
			AbsenceReason:   "",
		}

		if att.Type == "absence" {
			if att.Option != nil {
				data.AbsenceType = *att.Option
			}
			if att.Reason != nil {
				data.AbsenceReason = *att.Reason
			}
		}

		exportData = append(exportData, data)
	}

	// Create CSV
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = ';'

	// Write headers based on language
	var headers []string
	if lang == "id" {
		headers = []string{"No", "Nama", "Kehadiran", "Waktu", "Tanggal", "Jenis Ketidakhadiran", "Alasan Izin"}
	} else {
		headers = []string{"No", "Name", "Attendance", "Time", "Date", "Absence Type", "Absence Reason"}
	}
	writer.Write(headers)

	// Write data
	for _, data := range exportData {
		record := []string{
			fmt.Sprintf("%d", data.No),
			data.Name,
			data.Attendance,
			data.Time,
			data.Date,
			data.AbsenceType,
			data.AbsenceReason,
		}
		writer.Write(record)
	}

	writer.Flush()

	// Set response headers
	filename := fmt.Sprintf("attendance_export_%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "text/csv", buf.Bytes())
}

// ExportAttendancePDF exports attendance data to PDF using template
func (ctrl *AdminController) ExportAttendancePDF(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	duName := c.Query("du_name")
	duAddress := c.Query("du_address")
	studentIDsStr := c.Query("student_ids")

	// Parse dates
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid start_date format", utils.ErrInvalidQuery)
		return
	}
	
	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid end_date format", utils.ErrInvalidQuery)
		return
	}
	
	// Add one day to endDate to include the full day
	endDate = endDate.AddDate(0, 0, 1)

	// Parse student IDs
	var studentIDs []uuid.UUID
	if studentIDsStr != "" {
		idStrings := strings.Split(studentIDsStr, ",")
		for _, idStr := range idStrings {
			id, err := uuid.Parse(strings.TrimSpace(idStr))
			if err != nil {
				continue
			}
			studentIDs = append(studentIDs, id)
		}
	}

	// If no student IDs specified, get all non-admin users
	var students []models.User
	query := ctrl.DB.Where("type != ?", "admin")
	if len(studentIDs) > 0 {
		query = query.Where("id IN ?", studentIDs)
	}
	query.Order("nickname ASC").Find(&students)

	if len(students) == 0 {
		utils.RespondError(c, http.StatusBadRequest, "No students found", utils.ErrDataNotFound)
		return
	}

	// Fetch all attendances for the date range
	var attendances []models.Attendance
	ctrl.DB.Where("created_at >= ? AND created_at < ?", startDate, endDate).
		Where("user_id IN ?", func() []uuid.UUID {
			ids := make([]uuid.UUID, len(students))
			for i, s := range students {
				ids[i] = s.ID
			}
			return ids
		}()).
		Order("created_at ASC").
		Find(&attendances)

	// Build attendance map: userID -> date -> type/option
	attendanceMap := make(map[uuid.UUID]map[string]string)
	for _, att := range attendances {
		if attendanceMap[att.UserID] == nil {
			attendanceMap[att.UserID] = make(map[string]string)
		}
		dateKey := att.CreatedAt.Format("2006-01-02")
		
		// Determine mark: V (hadir), S (sakit), I (izin), A (alpha)
		mark := ""
		if att.Type == "attendance" {
			mark = "V"
		} else if att.Type == "absence" {
			if att.Option != nil {
				switch *att.Option {
				case "sick":
					mark = "S"
				case "absence":
					mark = "I"
				case "alpha":
					mark = "A"
				}
			}
		}
		attendanceMap[att.UserID][dateKey] = mark
	}

	// Generate day labels and dates for the period
	days := []time.Time{}
	for d := startDate; d.Before(endDate); d = d.AddDate(0, 0, 1) {
		days = append(days, d)
	}

	dayNames := []string{"Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"}
	
	// Build PDF data structure (12 days per block)
	pages := []models.PDFPage{}
	const daysPerBlock = 12
	
	for blockStart := 0; blockStart < len(days); blockStart += daysPerBlock {
		blockEnd := blockStart + daysPerBlock
		if blockEnd > len(days) {
			blockEnd = len(days)
		}
		blockDays := days[blockStart:blockEnd]
		
		// Prepare day labels and dates
		hariLabels := []string{}
		tanggalStrs := []string{}
		for _, d := range blockDays {
			hariLabels = append(hariLabels, dayNames[int(d.Weekday())])
			tanggalStrs = append(tanggalStrs, d.Format("02"))
		}
		
		// Pad to 12 days
		for len(hariLabels) < 12 {
			hariLabels = append(hariLabels, "")
			tanggalStrs = append(tanggalStrs, "")
		}
		
		// Build student rows
		siswaList := []models.PDFSiswa{}
		for _, student := range students {
			marks := []string{}
			countS, countI, countA := 0, 0, 0
			
			for _, d := range blockDays {
				dateKey := d.Format("2006-01-02")
				mark := attendanceMap[student.ID][dateKey]
				marks = append(marks, mark)
				
				// Count totals
				switch mark {
				case "S":
					countS++
				case "I":
					countI++
				case "A":
					countA++
				}
			}
			
			// Pad marks to 12
			for len(marks) < 12 {
				marks = append(marks, "")
			}
			
			siswaList = append(siswaList, models.PDFSiswa{
				Nama:  student.Nickname,
				Marks: marks,
				S:     countS,
				I:     countI,
				A:     countA,
			})
		}
		
		block := models.PDFBlock{
			HariLabel: hariLabels,
			Tanggal:   tanggalStrs,
			Siswa:     siswaList,
		}
		
		page := models.PDFPage{
			NamaDUDI:   duName,
			AlamatDUDI: duAddress,
			Blocks:     []models.PDFBlock{block},
		}
		
		pages = append(pages, page)
	}

	data := models.PDFTemplateData{
		Pages: pages,
	}

	// Define template functions
	funcMap := template.FuncMap{
		"inc": func(i int) int {
			return i + 1
		},
		"seq": func(n int) []int {
			result := make([]int, n)
			for i := range result {
				result[i] = i
			}
			return result
		},
	}

	// Render HTML template
	htmlContent, err := utils.RenderTemplate("templates/absensi_template.html", funcMap, data)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to render template", "RENDER_ERROR")
		return
	}

	// URL-encode the HTML content for data URL
	encodedHTML := url.PathEscape(htmlContent)

	// Generate PDF
	ctx := context.Background()
	pdfBytes, err := utils.GeneratePDFFromHTML(ctx, encodedHTML)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate PDF", "PDF_ERROR")
		return
	}

	// Set response headers
	filename := fmt.Sprintf("Rekap-Presensi_%s_%s.pdf", startDateStr, endDateStr)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
