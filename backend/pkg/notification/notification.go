package notification

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"

	"github.com/carakan/takota/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	DB *gorm.DB
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

	endpoint := user.PushSubscription.Endpoint
	if endpoint == "" {
		return nil
	}

	// Send the push notification
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(endpoint, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("Failed to send push notification: %v", err)
		return nil // Log but don't fail
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		// Subscription is invalid, clear it
		s.DB.Model(&user).Update("push_subscription", nil)
		return nil
	}

	return nil
}

func (s *Service) SendAttendanceReminder(userID string, hoursBefore int) error {
	hoursStr := ""
	if hoursBefore == 1 {
		hoursStr = "1 hour"
	} else {
		hoursStr = string(rune(hoursBefore)) + " hours"
	}

	return s.SendToUser(userID, &PushPayload{
		Title: "Attendance Reminder",
		Body:  "Don't forget to check in! Attendance closes in " + hoursStr + ".",
		Tag:   "attendance-reminder",
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
