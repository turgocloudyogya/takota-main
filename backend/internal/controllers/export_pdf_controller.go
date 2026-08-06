package controllers

import (
	"net/http"

	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
)

// ExportAttendanceReportData returns the assembled attendance recap as JSON
// (Doc/Pages/Blocks/Siswa structure, see internal/models/pdf_template.go), so
// the frontend can render it into the absensi_template.html markup and
// generate the PDF client-side (no server-side browser/Chromium needed).
//
// This mirrors the takota-app PDF export feature: same query params
// (start_date, end_date, du_name, du_address, student_ids), same shared
// buildAttendanceDoc/parseExportParams logic (see export_report.go), so the
// resulting PDF is byte-for-byte identical to the one produced there.
func (ctrl *AdminController) ExportAttendanceReportData(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	duName := c.Query("du_name")
	duAddress := c.Query("du_address")
	studentIDsStr := c.Query("student_ids")
	workDaysStr := c.Query("work_days")

	params, apiErr := parseExportParams(startDateStr, endDateStr, duName, duAddress, studentIDsStr, workDaysStr)
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
