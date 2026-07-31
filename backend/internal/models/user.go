package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID             uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
	Username       string     `gorm:"type:varchar(100);unique;not null" json:"username"`
	Password       string     `gorm:"type:varchar(255);not null" json:"-"`
	Nickname       string     `gorm:"type:varchar(150);not null" json:"nickname"`
	Callname       string     `gorm:"type:varchar(50);not null" json:"callname"`
	AuthID         *string    `gorm:"type:text" json:"-"`
	Type           string     `gorm:"type:varchar(20);not null;default:'user'" json:"type"`
	ChangeAsLogin  bool       `gorm:"default:false" json:"change_as_login"`
	LastLogin      *time.Time `gorm:"type:timestamptz" json:"last_login"`
	CreatedAt      time.Time  `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"type:timestamptz;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}
