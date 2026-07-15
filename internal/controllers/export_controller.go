package controllers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
)

type ExportData struct {
	No            int
	Name          string
	Attendance    string
	Time          string
	Date          string
	AbsenceType   string
	AbsenceReason string
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
			No:            i + 1,
			Name:          att.User.Nickname,
			Attendance:    att.Type,
			Time:          att.CreatedAt.Format("15:04:05"),
			Date:          att.CreatedAt.Format("2006-01-02"),
			AbsenceType:   "",
			AbsenceReason: "",
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

// ExportAttendanceReportData returns the assembled attendance recap as JSON
// (same Doc/Pages/Blocks/Siswa structure used for the XLSX export), so the
// frontend can render it into the absensi_template.html markup itself and
// generate the PDF client-side (no server-side browser/Chromium needed).
func (ctrl *AdminController) ExportAttendanceReportData(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	duName := c.Query("du_name")
	duAddress := c.Query("du_address")
	studentIDsStr := c.Query("student_ids")

	params, apiErr := parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr)
	if apiErr != nil {
		utils.RespondError(c, apiErr.Status, apiErr.Message, apiErr.Code)
		return
	}

	doc, apiErr := ctrl.buildAttendanceDoc(params)
	if apiErr != nil {
		utils.RespondError(c, apiErr.Status, apiErr.Message, apiErr.Code)
		return
	}

	utils.RespondSuccess(c, http.StatusOK, doc)
}

// ExportAttendanceXLSX exports the attendance recap to XLSX using the same
// shared data-assembly algorithm as the PDF export, so both outputs are
// always structurally identical.
func (ctrl *AdminController) ExportAttendanceXLSX(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	duName := c.Query("du_name")
	duAddress := c.Query("du_address")
	studentIDsStr := c.Query("student_ids")

	params, apiErr := parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr)
	if apiErr != nil {
		utils.RespondError(c, apiErr.Status, apiErr.Message, apiErr.Code)
		return
	}

	doc, apiErr := ctrl.buildAttendanceDoc(params)
	if apiErr != nil {
		utils.RespondError(c, apiErr.Status, apiErr.Message, apiErr.Code)
		return
	}

	buf, err := utils.GenerateAttendanceXLSX(*doc)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to generate XLSX", "XLSX_ERROR")
		return
	}

	filename := fmt.Sprintf("Rekap-Presensi_%s_%s.xlsx", startDateStr, endDateStr)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
}
