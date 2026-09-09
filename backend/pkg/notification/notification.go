package notification

import (
	"encoding/json"
	"log"

	"github.com/carakan/takota/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	DB *gorm.DB

	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string
}

type PushPayload struct {
	Title       string `json:"title"`
	Body        string `json:"body"`
	Icon        string `json:"icon,omitempty"`
	Badge       string `json:"badge,omitempty"`
	Tag         string `json:"tag,omitempty"`
	RequireInteraction bool `json:"requireInteraction,omitempty"`
	Data        map[string]string `json:"data,omitempty"`
}

func NewService(db *gorm.DB) *Service {
	return &Service{DB: db}
}

func (s *Service) SendToUser(userID string, payload *PushPayload) error {
	var user models.User
	if err := s.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}

	if user.PushSubscription == nil {
		return nil // No subscription, skip
	}

	sub := user.PushSubscription
	if sub.Endpoint == "" || sub.P256DH == "" || sub.Auth == "" {
		return nil
	}

	if s.VAPIDPublicKey == "" || s.VAPIDPrivateKey == "" {
		log.Println("VAPID keys not configured, skipping push notification")
		return nil
	}

	// Send the push notification
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	expired, err := SendWebPush(sub.Endpoint, sub.P256DH, sub.Auth, payloadBytes, s.VAPIDPublicKey, s.VAPIDPrivateKey, s.VAPIDSubject)
	if err != nil {
		log.Printf("Failed to send push notification: %v", err)
		return nil // Log but don't fail
	}

	if expired {
		// Subscription is invalid, clear it
		s.DB.Model(&user).Update("push_subscription", nil)
	}

	return nil
}

func (s *Service) SendAttendanceReminder(userID string, label string) error {
	return s.SendToUser(userID, &PushPayload{
		Title: "Attendance Reminder",
		Body:  "Don't forget to check in! " + label,
		Tag:   "attendance-reminder",
	})
}

func (s *Service) SendMissedAttendance(userID string) error {
	return s.SendToUser(userID, &PushPayload{
		Title: "You missed attendance today",
		Body:  "Attendance is now closed and no check-in was recorded for you today.",
		Tag:   "attendance-missed",
	})
}

func (s *Service) SendAbsenceDecision(userID string, decision string, approvedBy string) error {
	var body string
	if decision == "allow" {
		body = "Your absence request has been approved by " + approvedBy + "."
	} else {
		body = "Your absence request has been rejected."
	}

	return s.SendToUser(userID, &PushPayload{
		Title: "Absence Decision",
		Body:  body,
		Tag:   "absence-decision",
	})
}
