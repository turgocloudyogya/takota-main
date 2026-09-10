package notification

import (
	"context"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"gorm.io/gorm"
)

type Scheduler struct {
	DB *gorm.DB
	svc *Service

	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string

	mu           sync.Mutex
	sentReminder map[string]bool
	sentMissed   map[string]bool
}

func NewScheduler(db *gorm.DB) *Scheduler {
	return &Scheduler{
		DB:           db,
		svc:          NewService(db),
		sentReminder: map[string]bool{},
		sentMissed:   map[string]bool{},
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	s.svc.VAPIDPublicKey = s.VAPIDPublicKey
	s.svc.VAPIDPrivateKey = s.VAPIDPrivateKey
	s.svc.VAPIDSubject = s.VAPIDSubject

	go func() {
		ticker := time.NewTicker(5 * time.Minute) // Check every 5 minutes
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Println("Notification scheduler stopped")
				return
			case <-ticker.C:
				s.checkAndSendReminders()
			}
		}
	}()

	log.Println("✓ Push notification scheduler started")
}

func parseDayTime(now time.Time, hhmmss string) time.Time {
	parts := strings.Split(hhmmss, ":")
	hour, _ := strconv.Atoi(firstOr(parts, 0, "0"))
	min, _ := strconv.Atoi(firstOr(parts, 1, "0"))
	year, month, day := now.Date()
	return time.Date(year, month, day, hour, min, 0, 0, now.Location())
}

func firstOr(parts []string, i int, fallback string) string {
	if i < len(parts) {
		return parts[i]
	}
	return fallback
}

func (s *Scheduler) checkAndSendReminders() {
	var settings models.Settings
	if err := s.DB.First(&settings).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Printf("Error fetching settings: %v", err)
		}
		return
	}

	now := utils.Now()

	// Only run on configured open days.
	dayName := strings.ToLower(now.Weekday().String())
	openDay := false
	for _, d := range settings.OpenDays {
		if strings.ToLower(d) == dayName {
			openDay = true
			break
		}
	}
	if !openDay {
		return
	}

	openTime := parseDayTime(now, settings.AttendanceOpenTime)
	closeTime := parseDayTime(now, settings.AttendanceCloseTime)
	window := closeTime.Sub(openTime)
	if window <= 0 {
		return
	}

	// Reminder goes out 2 hours before close. When the window is 2 hours
	// or shorter, remind at 60% of the window instead.
	reminderAt := closeTime.Add(-2 * time.Hour)
	reminderLabel := "Attendance closes in 2 hours."
	if window <= 2*time.Hour {
		reminderAt = openTime.Add(time.Duration(float64(window) * 0.6))
		reminderLabel = "Attendance closes soon."
	}

	todayKey := now.Format("2006-01-02")

	s.mu.Lock()
	reminderDone := s.sentReminder[todayKey]
	missedDone := s.sentMissed[todayKey]
	s.mu.Unlock()

	if !reminderDone && !now.Before(reminderAt) && now.Sub(reminderAt) <= 5*time.Minute {
		count := s.sendToEligibleUsers(func(userID string) error {
			return s.svc.SendAttendanceReminder(userID, reminderLabel)
		}, now)
		log.Printf("Sent %d attendance reminders (%s)", count, reminderLabel)
		s.mu.Lock()
		s.sentReminder[todayKey] = true
		s.mu.Unlock()
	}

	// After closing (+5 min grace), notify users who never checked in.
	missedAt := closeTime.Add(5 * time.Minute)
	if !missedDone && !now.Before(missedAt) && now.Sub(missedAt) <= 5*time.Minute {
		count := s.sendToEligibleUsers(func(userID string) error {
			return s.svc.SendMissedAttendance(userID)
		}, now)
		log.Printf("Sent %d missed-attendance notifications", count)
		s.mu.Lock()
		s.sentMissed[todayKey] = true
		s.mu.Unlock()
	}
}

// sendToEligibleUsers delivers payload to every subscribed user who has
// neither checked in today nor holds an approved absence covering today
// (multi-day approvals included). Returns the number of users notified.
func (s *Scheduler) sendToEligibleUsers(send func(userID string) error, now time.Time) int {
	var users []models.User
	if err := s.DB.Where("push_subscription IS NOT NULL").Find(&users).Error; err != nil {
		log.Printf("Error fetching users for reminder: %v", err)
		return 0
	}

	year, month, day := now.Date()
	dayStart := time.Date(year, month, day, 0, 0, 0, 0, now.Location())
	dayEnd := dayStart.Add(24 * time.Hour)

	sent := 0
	for _, user := range users {
		if s.hasCheckedInToday(user.ID.String(), dayStart, dayEnd) {
			continue
		}
		if s.hasCoveringAbsence(user.ID.String(), dayStart, dayEnd) {
			continue
		}
		if err := send(user.ID.String()); err != nil {
			log.Printf("Error sending notification to user %s: %v", user.ID, err)
			continue
		}
		sent++
	}
	return sent
}

func (s *Scheduler) hasCheckedInToday(userID string, dayStart, dayEnd time.Time) bool {
	var count int64
	s.DB.Model(&models.Attendance{}).
		Where("user_id = ? AND type = ? AND created_at >= ? AND created_at < ?", userID, "attendance", dayStart, dayEnd).
		Count(&count)
	return count > 0
}

func (s *Scheduler) hasCoveringAbsence(userID string, dayStart, dayEnd time.Time) bool {
	var count int64
	s.DB.Model(&models.Attendance{}).
		Where("user_id = ? AND type = ? AND sign_status = ? AND absence_start_date <= ? AND (absence_end_date IS NULL OR absence_end_date >= ?)",
			userID, "absence", "allow", dayEnd, dayStart).
		Count(&count)
	return count > 0
}
