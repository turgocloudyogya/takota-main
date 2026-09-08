package models

import (
	"time"

	"github.com/google/uuid"
)

type PushSubscription struct {
	Endpoint string `json:"endpoint"`
	Auth     string `json:"auth"`
	P256DH   string `json:"p256dh"`
}

type User struct {
	ID                uuid.UUID          `gorm:"type:uuid;primary_key" json:"id"`
	Username          string             `gorm:"type:varchar(100);unique;not null" json:"username"`
	Password          string             `gorm:"type:varchar(255);not null" json:"-"`
	Nickname          string             `gorm:"type:varchar(150);not null" json:"nickname"`
	Callname          string             `gorm:"type:varchar(50);not null" json:"callname"`
	AuthID            *string            `gorm:"type:text" json:"-"`
	Type              string             `gorm:"type:varchar(20);not null;default:'user'" json:"type"`
	ChangeAsLogin     bool               `gorm:"default:false" json:"change_as_login"`
	TOTPEnabled       bool               `gorm:"default:false" json:"totp_enabled"`
	TOTPSecret        *string            `gorm:"type:varchar(255)" json:"-"`
	PushSubscription  *PushSubscription  `gorm:"type:jsonb;serializer:json" json:"-"`
	LastLogin         *time.Time         `gorm:"type:timestamptz" json:"last_login"`
	CreatedAt         time.Time          `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt         time.Time          `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
