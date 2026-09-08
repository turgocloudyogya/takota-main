package notification

import (
	"context"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/carakan/takota/internal/models"
	"gorm.io/gorm"
)

type Scheduler struct {
	DB *gorm.DB
	svc *Service
}

func NewScheduler(db *gorm.DB) *Scheduler {
	return &Scheduler{
		DB: db,
		svc: NewService(db),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
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

func (s *Scheduler) checkAndSendReminders() {
	var settings models.Settings
	if err := s.DB.First(&settings).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Printf("Error fetching settings: %v", err)
		}
		return
	}

	now := time.Now()
	year, month, day := now.Date()

	// Parse close time string (format: "HH:MM:SS")
	closeTimeParts := strings.Split(settings.AttendanceCloseTime, ":")
	closeHour, _ := strconv.Atoi(closeTimeParts[0])
	closeMin, _ := strconv.Atoi(closeTimeParts[1])
	closeTime := time.Date(year, month, day, closeHour, closeMin, 0, 0, now.Location())

	// Send reminders 1 hour before and 3 hours before
	sendReminder1h := closeTime.Add(-1 * time.Hour)
	sendReminder3h := closeTime.Add(-3 * time.Hour)

	// Check if we're in the reminder window (within 5 minutes of the send time)
	timeDiff1h := now.Sub(sendReminder1h)
	if timeDiff1h >= 0 && timeDiff1h <= 5*time.Minute {
		s.sendRemindersToAllUsers(1)
	}

	timeDiff3h := now.Sub(sendReminder3h)
	if timeDiff3h >= 0 && timeDiff3h <= 5*time.Minute {
		s.sendRemindersToAllUsers(3)
	}
}

func (s *Scheduler) sendRemindersToAllUsers(hoursBefore int) {
	var users []models.User
	if err := s.DB.Where("push_subscription IS NOT NULL").Find(&users).Error; err != nil {
		log.Printf("Error fetching users for reminder: %v", err)
		return
	}

	for _, user := range users {
		if err := s.svc.SendAttendanceReminder(user.ID.String(), hoursBefore); err != nil {
			log.Printf("Error sending reminder to user %s: %v", user.ID, err)
		}
	}

	log.Printf("Sent %d attendance reminders (%d hour(s) before close)", len(users), hoursBefore)
}
