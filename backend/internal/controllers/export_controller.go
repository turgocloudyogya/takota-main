package controllers

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/carakan/takota/pkg/s3"
	"github.com/gin-gonic/gin"
)

type ExportData struct {
	No            int
	Nickname      string
	UserID        string
	Name          string
	Username      string
	Attendance    string
	Time          string
	Date          string
	Latitude      string
	Longitude     string
	TimeISO       string
	TimeGMT       string
	AbsenceType   string
	AbsenceReason string
	Location      string
	PhotoFile     string
	DocumentFile  string
}

// ExportAttendance exports attendance data for a selected month and year.
// Supported lang values:
//   - en     -> English CSV headers
//   - id     -> Indonesian CSV headers
//   - params -> lowercase snake_case CSV headers
//   - json   -> JSON object with metadata and items array (params-style field names)
func (ctrl *AdminController) ExportAttendance(c *gin.Context) {
	month := c.Query("month")
	year := c.Query("year")
	lang := c.Query("lang")

	if lang == "" {
		lang = "en"
	}

	// Validate language
	if lang != "en" && lang != "id" && lang != "params" && lang != "json" {
		utils.RespondError(c, http.StatusBadRequest, "Invalid query parameters", utils.ErrInvalidQuery)
		return
	}

	// Parse month (defaults to the current month)
	now := utils.Now()
	monthNum := int(now.Month())
	if month != "" {
		monthNum = utils.GetMonthNumber(strings.ToLower(month))
		if monthNum == 0 {
			utils.RespondError(c, http.StatusBadRequest, "Invalid query parameters", utils.ErrInvalidQuery)
			return
		}
	}

	// Parse year (defaults to the current year)
	yearNum := now.Year()
	if year != "" {
		parsed, err := strconv.Atoi(year)
		if err != nil || parsed < 2000 || parsed > 9999 {
			utils.RespondError(c, http.StatusBadRequest, "Invalid query parameters", utils.ErrInvalidQuery)
			return
		}
		yearNum = parsed
	}

	// Get admin info from context
	adminUserID, _ := c.Get("user_id")
	adminUsername, _ := c.Get("username")
	adminNickname := ""
	adminName := ""
	if uid, ok := adminUserID.(string); ok {
		var adminUser models.User
		if err := ctrl.DB.Where("id = ?", uid).First(&adminUser).Error; err == nil {
			adminNickname = adminUser.Nickname
			adminName = adminUser.Callname
		}
	}

	startDate := time.Date(yearNum, time.Month(monthNum), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, 0)

	// Fetch attendance data
	var attendances []models.Attendance
	ctrl.DB.Where("created_at >= ? AND created_at < ?", startDate, endDate).
		Preload("User").
		Order("created_at ASC").
		Find(&attendances)

	// Prepare CSV data (time/date shown in the configured app timezone)
	loc := utils.AppLocation()
	timeGMT := utils.GMTOffset()
	var exportData []ExportData
	for i, att := range attendances {
		localTime := att.CreatedAt.In(loc)
		data := ExportData{
			No:            i + 1,
			Nickname:      att.User.Nickname,
			UserID:        att.UserID.String(),
			Name:          att.User.Callname,
			Username:      att.User.Username,
			Attendance:    att.Type,
			Time:          localTime.Format("15:04:05"),
			Date:          localTime.Format("2006-01-02"),
			Latitude:      "",
			Longitude:     "",
			TimeISO:       att.CreatedAt.Format(time.RFC3339),
			TimeGMT:       timeGMT,
			AbsenceType:   "",
			AbsenceReason: "",
		}

		if att.Latitude != nil {
			data.Latitude = *att.Latitude
		}
		if att.Longitude != nil {
			data.Longitude = *att.Longitude
		}

		if att.Type == "absence" {
			if att.Option != nil {
				data.AbsenceType = *att.Option
			}
			if att.Reason != nil {
				data.AbsenceReason = *att.Reason
			}
			if att.File != nil {
				data.DocumentFile = s3.BucketOpenURL(*att.File)
			}
		}

		// Location as a Google Maps link when coordinates are present
		if att.Latitude != nil && att.Longitude != nil {
			data.Location = utils.GenerateGoogleMapsLink(*att.Latitude, *att.Longitude)
		}

		// Attendance photo public URL when present
		if att.Photo != nil {
			data.PhotoFile = s3.BucketOpenURL(*att.Photo)
		}

		exportData = append(exportData, data)
	}

	// JSON export: structured object with metadata and items
	if lang == "json" {
		type jsonItem struct {
			No            int    `json:"no"`
			ID            string `json:"id"`
			Nickname      string `json:"nickname"`
			Name          string `json:"name"`
			Username      string `json:"username"`
			Attendance    string `json:"attendance"`
			Time          string `json:"time"`
			Date          string `json:"date"`
			Latitude      string `json:"latitude"`
			Longitude     string `json:"longitude"`
			TimeISO       string `json:"time_iso"`
			TimeGMT       string `json:"time_gmt"`
			AbsenceType   string `json:"absence_type"`
			AbsenceReason string `json:"absence_reason"`
			Location      string `json:"location"`
			PhotoFile     string `json:"photo_file"`
			Document      string `json:"document"`
		}

		type adminExport struct {
			ID        string `json:"id"`
			Nickname  string `json:"nickname"`
			Name      string `json:"name"`
			Username  string `json:"username"`
		}

		type exportResponse struct {
			TimeExport  string      `json:"time_export"`
			AdminExport adminExport `json:"admin_export"`
			Items       []jsonItem  `json:"items"`
		}

		items := make([]jsonItem, 0, len(exportData))
		for _, data := range exportData {
			items = append(items, jsonItem{
				No:            data.No,
				ID:            data.UserID,
				Nickname:      data.Nickname,
				Name:          data.Name,
				Username:      data.Username,
				Attendance:    data.Attendance,
				Time:          data.Time,
				Date:          data.Date,
				Latitude:      data.Latitude,
				Longitude:     data.Longitude,
				TimeISO:       data.TimeISO,
				TimeGMT:       data.TimeGMT,
				AbsenceType:   data.AbsenceType,
				AbsenceReason: data.AbsenceReason,
				Location:      data.Location,
				PhotoFile:     data.PhotoFile,
				Document:      data.DocumentFile,
			})
		}

		adminID := ""
		if uid, ok := adminUserID.(string); ok {
			adminID = uid
		}

		response := exportResponse{
			TimeExport: now.Format(time.RFC3339),
			AdminExport: adminExport{
				ID:        adminID,
				Nickname:  adminNickname,
				Name:      adminName,
				Username:  adminUsername.(string),
			},
			Items: items,
		}

		filename := fmt.Sprintf("attendance_export_%04d-%02d.json", yearNum, monthNum)
		c.Header("Content-Description", "File Transfer")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
		c.JSON(http.StatusOK, response)
		return
	}

	// Create CSV
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	writer.Comma = ';'

	// Write headers based on language (added "ID" after "No", removed "User ID")
	var headers []string
	switch lang {
	case "id":
		headers = []string{"No", "ID", "Nickname", "Nama", "Username", "Kehadiran", "Waktu", "Tanggal", "Latitude", "Longitude", "Waktu ISO", "Waktu GMT", "Jenis Ketidakhadiran", "Alasan Izin", "Lokasi", "File Foto", "Dokumen"}
	case "params":
		headers = []string{"no", "id", "nickname", "name", "username", "attendance", "time", "date", "latitude", "longitude", "time_iso", "time_gmt", "absence_type", "absence_reason", "location", "photo_file", "document"}
	default:
		headers = []string{"No", "ID", "Nickname", "Name", "Username", "Attendance", "Time", "Date", "Latitude", "Longitude", "Time ISO", "Time GMT", "Absence Type", "Absence Reason", "Location", "Photo File", "Document"}
	}
	writer.Write(headers)

	// Write data (added ID after No, removed User ID)
	for _, data := range exportData {
		record := []string{
			fmt.Sprintf("%d", data.No),
			data.UserID,
			data.Nickname,
			data.Name,
			data.Username,
			data.Attendance,
			data.Time,
			data.Date,
			data.Latitude,
			data.Longitude,
			data.TimeISO,
			data.TimeGMT,
			data.AbsenceType,
			data.AbsenceReason,
			data.Location,
			data.PhotoFile,
			data.DocumentFile,
		}
		writer.Write(record)
	}

	writer.Flush()

	// Set response headers
	filename := fmt.Sprintf("attendance_export_%04d-%02d.csv", yearNum, monthNum)
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Data(http.StatusOK, "text/csv", buf.Bytes())
}
