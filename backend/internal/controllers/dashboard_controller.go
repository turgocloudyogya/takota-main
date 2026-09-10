package controllers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
)

type DashboardStats struct {
	TotalAttendance    int64       `json:"total_attendance"`
	TotalAbsence       int64       `json:"total_absence"`
	TotalAlpha         int64       `json:"total_alpha"`
	TotalUsers         int64       `json:"total_users"`
	PendingApprovals   int64       `json:"pending_approvals"`
	AttendanceToday    int64       `json:"attendance_today"`
	AbsenceToday       int64       `json:"absence_today"`
	MostFrequentTime   string      `json:"most_frequent_time"`
	AverageAttendance  float64     `json:"average_attendance"`
	AttendanceRate     float64     `json:"attendance_rate"`
	WeeklyAvgCheckins  float64     `json:"weekly_avg_checkins"`
	WeeklyAvgAbsences  float64     `json:"weekly_avg_absences"`
}

// GetDashboardStats retrieves dashboard statistics
func (ctrl *AdminController) GetDashboardStats(c *gin.Context) {
	var stats DashboardStats

	// Get total users
	if err := ctrl.DB.Model(&models.User{}).
		Where("type = ?", "user").
		Count(&stats.TotalUsers).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get user count", "DB_ERROR")
		return
	}

	// Get total attendance records
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ?", "attendance").
		Count(&stats.TotalAttendance).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get attendance count", "DB_ERROR")
		return
	}

	// Get total absence records
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ?", "absence").
		Count(&stats.TotalAbsence).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get absence count", "DB_ERROR")
		return
	}

	// Get pending approvals (absence with sign_status IS NULL)
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND sign_status IS NULL", "absence").
		Count(&stats.PendingApprovals).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get pending count", "DB_ERROR")
		return
	}

	// Get today's attendance (app timezone day bounds)
	now := utils.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND created_at >= ?", "attendance", dayStart).
		Count(&stats.AttendanceToday).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get today attendance count", "DB_ERROR")
		return
	}

	// Get today's absence (approved or pending counts as non-alpha)
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND created_at >= ? AND (sign_status IS NULL OR sign_status = ?)", "absence", dayStart, "allow").
		Count(&stats.AbsenceToday).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get today absence count", "DB_ERROR")
		return
	}

	// Calculate alpha: users with neither attendance nor valid absence today.
	// Closed days (per settings open_days) are holidays, never alpha.
	var settings models.Settings
	isOpenDay := true
	if err := ctrl.DB.First(&settings).Error; err == nil {
		isOpenDay = settings.IsAttendanceOpen(now, settings.OpenDays)
		_ = isOpenDay
		dayName := now.Weekday().String()
		lower := ""
		for _, r := range dayName {
			if r >= 'A' && r <= 'Z' {
				lower += string(r + 32)
			} else {
				lower += string(r)
			}
		}
		isOpenDay = false
		for _, d := range settings.OpenDays {
			dl := ""
			for _, r := range d {
				if r >= 'A' && r <= 'Z' {
					dl += string(r + 32)
				} else {
					dl += string(r)
				}
			}
			if dl == lower {
				isOpenDay = true
				break
			}
		}
	}
	var attendedUsersCount int64
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("created_at >= ? AND ((type = ?) OR (type = ? AND (sign_status IS NULL OR sign_status = ?)))", dayStart, "attendance", "absence", "allow").
		Distinct("user_id").
		Count(&attendedUsersCount).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to calculate alpha", "DB_ERROR")
		return
	}

	if !isOpenDay {
		stats.TotalAlpha = 0
	} else {
		stats.TotalAlpha = stats.TotalUsers - attendedUsersCount
		if stats.TotalAlpha < 0 {
			stats.TotalAlpha = 0
		}
	}

	// Get most frequent attendance time (hour with most submissions)
	var result struct {
		Hour  string
		Count int64
	}
	if err := ctrl.DB.Model(&models.Attendance{}).
		Select("TO_CHAR(created_at, 'HH24:00') as hour, COUNT(*) as count").
		Where("type = ?", "attendance").
		Group("TO_CHAR(created_at, 'HH24:00')").
		Order("count DESC").
		Limit(1).
		Scan(&result).Error; err == nil && result.Hour != "" {
		stats.MostFrequentTime = result.Hour
	} else {
		stats.MostFrequentTime = "—"
	}

	// Calculate attendance rate
	if stats.TotalUsers > 0 && stats.TotalAttendance > 0 {
		stats.AttendanceRate = float64(attendedUsersCount) / float64(stats.TotalUsers) * 100
		stats.AverageAttendance = float64(stats.TotalAttendance) / float64(stats.TotalUsers)
	}

	// Weekly daily averages (last 7 days / 7)
	weekAgo := utils.Now().AddDate(0, 0, -7)
	var weekCheckins, weekAbsences int64
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND created_at >= ?", "attendance", weekAgo).
		Count(&weekCheckins).Error; err == nil {
		stats.WeeklyAvgCheckins = float64(weekCheckins) / 7
	}
	if err := ctrl.DB.Model(&models.Attendance{}).
		Where("type = ? AND created_at >= ?", "absence", weekAgo).
		Count(&weekAbsences).Error; err == nil {
		stats.WeeklyAvgAbsences = float64(weekAbsences) / 7
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": stats,
	})
}

// GetAttendanceTrend retrieves attendance data for the last 7 days
func (ctrl *AdminController) GetAttendanceTrend(c *gin.Context) {
	type row struct {
		Date  string `json:"date"`
		Type  string `json:"type"`
		Count int64  `json:"count"`
	}
	var rows []row

	sevenDaysAgo := utils.Now().AddDate(0, 0, -7)

	if err := ctrl.DB.Model(&models.Attendance{}).
		Select("TO_CHAR(created_at, 'YYYY-MM-DD') as date, type, COUNT(*) as count").
		Where("created_at >= ?", sevenDaysAgo).
		Group("TO_CHAR(created_at, 'YYYY-MM-DD'), type").
		Order("date").
		Scan(&rows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to get attendance trend", "DB_ERROR")
		return
	}

	merged := map[string]map[string]int64{}
	var order []string
	for _, r := range rows {
		if _, ok := merged[r.Date]; !ok {
			merged[r.Date] = map[string]int64{}
			order = append(order, r.Date)
		}
		merged[r.Date][r.Type] = r.Count
	}
	trends := []gin.H{}
	for _, d := range order {
		trends = append(trends, gin.H{
			"date":       d,
			"attendance": merged[d]["attendance"],
			"absence":    merged[d]["absence"],
		})
	}
	if trends == nil {
		trends = []gin.H{}
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": trends,
	})
}

type ActivityDay struct {
	Date            string  `json:"date"`
	Present         int     `json:"present"`
	Leave           int     `json:"leave"`
	Alpha           int     `json:"alpha"`
	Unreported      int     `json:"unreported"`
	Total           int     `json:"total"`
	Level           int     `json:"level"`
	PresentPct      float64 `json:"present_pct"`
	LeavePct        float64 `json:"leave_pct"`
	AlphaPct        float64 `json:"alpha_pct"`
	UnreportedPct   float64 `json:"unreported_pct"`
	Closed          bool    `json:"closed"`
	Future          bool    `json:"future"`
}

// GetActivityHeatmap returns per-day attendance activity for a GitHub-style
// heatmap. Query params: days (default 112, max 365), user_id (optional,
// limits to one regular user). Alpha only applies to past open days; today
// uses "unreported" instead. Closed days (per settings open_days) are gray.
func (ctrl *AdminController) GetActivityHeatmap(c *gin.Context) {
	days := parseDaysParam(c)
	filterUserID := strings.TrimSpace(c.Query("user_id"))

	var users []models.User
	q := ctrl.DB.Model(&models.User{}).Where("type = ?", "user")
	if filterUserID != "" {
		q = q.Where("id = ?", filterUserID)
	}
	if err := q.Find(&users).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to load users", "DB_ERROR")
		return
	}
	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": ctrl.buildActivityDays(days, users, false),
	})
}

// GetUserActivityHeatmap returns the personal activity heatmap for the
// authenticated regular user (their days only). Single-user colors:
// green = present, yellow = leave, red = alpha, gray = empty/unreported.
func (ctrl *UserController) GetUserActivityHeatmap(c *gin.Context) {
	days := parseDaysParam(c)
	userID, _ := c.Get("user_id")

	var user models.User
	if err := ctrl.DB.Where("id = ? AND type = ?", userID, "user").First(&user).Error; err != nil {
		utils.RespondSuccess(c, http.StatusOK, gin.H{"data": []ActivityDay{}})
		return
	}
	admin := &AdminController{DB: ctrl.DB, Config: ctrl.Config}
	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"data": admin.buildActivityDays(days, []models.User{user}, true),
	})
}

func parseDaysParam(c *gin.Context) int {
	days := 112
	if q := c.Query("days"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n > 0 && n <= 365 {
			days = n
		}
	}
	return days
}

// buildActivityDays computes per-day buckets for the given users. When single
// is true the levels use personal colors (present green, leave yellow,
// alpha red, empty gray) instead of the aggregate percentage buckets.
func (ctrl *AdminController) buildActivityDays(days int, users []models.User, single bool) []ActivityDay {
	total := len(users)
	userIDs := map[string]bool{}
	for _, u := range users {
		userIDs[u.ID.String()] = true
	}

	loc := utils.AppLocation()
	now := utils.Now()
	todayKey := now.In(loc).Format("2006-01-02")
	startDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -(days - 1))
	rangeStart := startDay.Add(-48 * time.Hour)

	var settings models.Settings
	openDays := []string{"monday", "tuesday", "wednesday", "thursday", "friday"}
	if err := ctrl.DB.First(&settings).Error; err == nil && len(settings.OpenDays) > 0 {
		openDays = settings.OpenDays
	}
	openSet := map[string]bool{}
	for _, d := range openDays {
		openSet[strings.ToLower(strings.TrimSpace(d))] = true
	}

	type row struct {
		UserID    string
		CreatedAt time.Time
		Start     *time.Time
		End       *time.Time
		Sign      *string
	}
	var attendances []row
	ctrl.DB.Model(&models.Attendance{}).
		Select("user_id, created_at").
		Where("type = ? AND created_at >= ?", "attendance", rangeStart).
		Find(&attendances)
	var absences []row
	ctrl.DB.Model(&models.Attendance{}).
		Select("user_id, created_at, absence_start_date AS start, absence_end_date AS end, sign_status AS sign").
		Where("type = ? AND (created_at >= ? OR absence_end_date >= ?)", "absence", rangeStart, rangeStart).
		Find(&absences)

	presentByDay := map[string]map[string]bool{}
	leaveByDay := map[string]map[string]bool{}
	markPresent := func(uid string, t time.Time) {
		if !userIDs[uid] {
			return
		}
		k := t.In(loc).Format("2006-01-02")
		if presentByDay[k] == nil {
			presentByDay[k] = map[string]bool{}
		}
		presentByDay[k][uid] = true
	}
	markLeave := func(uid, day string) {
		if !userIDs[uid] {
			return
		}
		if leaveByDay[day] == nil {
			leaveByDay[day] = map[string]bool{}
		}
		leaveByDay[day][uid] = true
	}
	for _, a := range attendances {
		markPresent(a.UserID, a.CreatedAt)
	}
	dayKey := func(t time.Time) string { return t.In(loc).Format("2006-01-02") }
	for _, a := range absences {
		if a.Sign != nil && strings.ToLower(*a.Sign) == "reject" {
			continue
		}
		if a.Start != nil && a.End != nil {
			for d := a.Start.In(loc); !d.After(a.End.In(loc)); d = d.AddDate(0, 0, 1) {
				k := dayKey(d)
				if k >= startDay.Format("2006-01-02") && k <= todayKey {
					markLeave(a.UserID, k)
				}
			}
		} else {
			k := dayKey(a.CreatedAt)
			if k >= startDay.Format("2006-01-02") && k <= todayKey {
				markLeave(a.UserID, k)
			}
		}
	}

	out := []ActivityDay{}
	lastPast := startDay.AddDate(0, 0, days-1)
	// Extend to the end of the week (Sunday) so the grid is complete;
	// days after today are pale "upcoming" cells.
	endDay := lastPast
	for endDay.Weekday() != time.Sunday {
		endDay = endDay.AddDate(0, 0, 1)
	}
	for day := startDay; !day.After(endDay); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		dayName := strings.ToLower(day.Weekday().String())
		closed := !openSet[dayName]

		d := ActivityDay{Date: key, Total: total, Closed: closed, Future: key > todayKey}
		if d.Future {
			d.Level = 0
			out = append(out, d)
			continue
		}
		if closed || total == 0 {
			d.Level = 0
			out = append(out, d)
			continue
		}
		present := len(presentByDay[key])
		leave := 0
		for uid := range leaveByDay[key] {
			if !presentByDay[key][uid] {
				leave++
			}
		}
		if present == 0 && leave == 0 {
			// Truly empty day: gray like a day off, never alpha.
			d.Level = 0
			out = append(out, d)
			continue
		}
		rest := total - present - leave
		if rest < 0 {
			rest = 0
		}
		d.Present = present
		d.Leave = leave
		if key == todayKey {
			d.Unreported = rest
		} else {
			d.Alpha = rest
		}
		d.PresentPct = pct(present, total)
		d.LeavePct = pct(leave, total)
		d.AlphaPct = pct(d.Alpha, total)
		d.UnreportedPct = pct(d.Unreported, total)
		if single {
			d.Level = singleActivityLevel(present > 0, leave > 0, d.Alpha > 0)
		} else if present == 1 && leave == 0 && rest > 0 {
			// Lone reporter: only 1 present while the rest unreported.
			d.Level = 6
		} else {
			d.Level = activityLevel(present, d.PresentPct)
		}
		out = append(out, d)
	}

	return out
}

// singleActivityLevel maps one user's day to personal colors:
// green (present), yellow (leave), red (alpha), gray (empty/unreported).
func singleActivityLevel(present, leave, alpha bool) int {
	switch {
	case present:
		return 5
	case leave:
		return 3
	case alpha:
		return 1
	default:
		return 0
	}
}

func pct(n, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(n) / float64(total) * 100
}

// activityLevel maps a day to a heatmap bucket. Truly empty days never reach
// here (they stay gray). Red means token attendance (below 5% present) or
// leave-only days; 2 orange (5-49%), 3 yellow (50-79%), 4 light green
// (80-99%), 5 dark green (100% present). Level 6 (lone reporter) is assigned
// separately by the caller.
func activityLevel(present int, presentPct float64) int {
	switch {
	case presentPct >= 100:
		return 5
	case presentPct >= 80:
		return 4
	case presentPct >= 50:
		return 3
	case presentPct >= 5:
		return 2
	case present > 0:
		return 1
	default:
		return 1
	}
}
