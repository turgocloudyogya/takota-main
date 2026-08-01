package models

import (
	"time"

	"github.com/google/uuid"
)

type Attendance struct {
	ID         uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Type       string     `gorm:"type:varchar(20);not null" json:"type"` // attendance or absence
	Option     *string    `gorm:"type:varchar(20)" json:"option"`        // sick, absence, alpha
	Reason     *string    `gorm:"type:text" json:"reason"`
	Photo      *string    `gorm:"type:varchar(255)" json:"photo"`
	File       *string    `gorm:"type:varchar(255)" json:"file"`
	Latitude   *string    `gorm:"type:varchar(50)" json:"latitude"`
	Longitude  *string    `gorm:"type:varchar(50)" json:"longitude"`
	GmapsEmbed     *string    `gorm:"type:text" json:"gmaps_embed"`
	DisplayAddress *string    `gorm:"type:text" json:"display_address"` // reverse-geocoded address for display
	VerifyBy   *uuid.UUID `gorm:"type:uuid" json:"verify_by"`
	SignStatus *string    `gorm:"type:varchar(20)" json:"sign_status"` // allow, reject, or NULL (pending)
	CreatedAt  time.Time  `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt  time.Time  `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Relations
	User     User  `gorm:"foreignKey:UserID;references:ID" json:"-"`
	Verifier *User `gorm:"foreignKey:VerifyBy;references:ID" json:"-"`
}

func (Attendance) TableName() string {
	return "attendance"
}
