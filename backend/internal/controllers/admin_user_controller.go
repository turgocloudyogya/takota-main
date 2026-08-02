package controllers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/utils"
	"github.com/carakan/takota/pkg/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserListResponse struct {
	Data   []UserListItem `json:"data"`
	LastID *string        `json:"last_id"`
}

type UserListItem struct {
	ID        string     `json:"id"`
	Username  string     `json:"username"`
	Nickname  string     `json:"nickname"`
	Callname  string     `json:"callname"`
	Type      string     `json:"type"`
	LastLogin *time.Time `json:"last_login"`
}

type CreateUserRequest struct {
	Username      string `json:"username" binding:"required"`
	Nickname      string `json:"nickname" binding:"required"`
	Callname      string `json:"callname" binding:"required"`
	Type          string `json:"type" binding:"required"`
	Password      string `json:"password" binding:"required"`
	ChangeAsLogin bool   `json:"change_as_login"`
}

type UpdateUserRequest struct {
	Username      string `json:"username"`
	Nickname      string `json:"nickname"`
	Callname      string `json:"callname"`
	Type          string `json:"type"`
	Password      string `json:"password"`
	ChangeAsLogin *bool  `json:"change_as_login"`
}

// ListUsers returns list of all users
func (ctrl *AdminController) ListUsers(c *gin.Context) {
	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	lastID := c.Query("last_id")
	search := c.Query("search")

	query := ctrl.DB.Model(&models.User{})

	// Apply search filter
	if search != "" {
		query = query.Where("username LIKE ? OR nickname LIKE ? OR callname LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	// Apply cursor pagination
	if lastID != "" {
		query = query.Where("id < ?", lastID)
	}

	var users []models.User
	query.Order("created_at DESC").Limit(limit + 1).Find(&users)

	// Check if there are more results
	hasMore := len(users) > limit
	if hasMore {
		users = users[:limit]
	}

	// Build response
	items := []UserListItem{}
	for _, user := range users {
		items = append(items, UserListItem{
			ID:        user.ID.String(),
			Username:  user.Username,
			Nickname:  user.Nickname,
			Callname:  user.Callname,
			Type:      user.Type,
			LastLogin: user.LastLogin,
		})
	}

	var nextLastID *string
	if hasMore && len(items) > 0 {
		lastItem := items[len(items)-1]
		nextLastID = &lastItem.ID
	}

	utils.RespondSuccess(c, http.StatusOK, UserListResponse{
		Data:   items,
		LastID: nextLastID,
	})
}

// CreateUser creates a new user
func (ctrl *AdminController) CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Fill all input", utils.ErrBodyFillAll)
		return
	}

	// Check if username already exists
	var existingUser models.User
	if err := ctrl.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		utils.RespondError(c, http.StatusBadRequest, "Username already exists", utils.ErrUsernameExists)
		return
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to hash password", "HASH_ERROR")
		return
	}

	// Create user
	user := models.User{
		ID:            uuid.New(),
		Username:      req.Username,
		Password:      hashedPassword,
		Nickname:      req.Nickname,
		Callname:      req.Callname,
		Type:          req.Type,
		ChangeAsLogin: req.ChangeAsLogin,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := ctrl.DB.Create(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to create user", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "User created successfully",
		"data": gin.H{
			"id": user.ID.String(),
		},
	})
}

// UpdateUser updates an existing user
func (ctrl *AdminController) UpdateUser(c *gin.Context) {
	userID := c.Param("user_id")
	uid, err := uuid.Parse(userID)
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Invalid request", utils.ErrBodyFillAll)
		return
	}

	// Find user
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// Check if username already exists (if changing username)
	if req.Username != "" && req.Username != user.Username {
		var existingUser models.User
		if err := ctrl.DB.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
			utils.RespondError(c, http.StatusBadRequest, "Username already exists", utils.ErrUsernameExists)
			return
		}
		user.Username = req.Username
	}

	// Update fields
	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Callname != "" {
		user.Callname = req.Callname
	}
	if req.Type != "" && req.Type != user.Type {
		// The database must always keep at least one admin: never demote the last admin.
		if user.Type == "admin" && req.Type != "admin" {
			var adminCount int64
			if err := ctrl.DB.Model(&models.User{}).Where("type = ?", "admin").Count(&adminCount).Error; err != nil {
				utils.RespondError(c, http.StatusInternalServerError, "Failed to update user", "DB_ERROR")
				return
			}
			if adminCount <= 1 {
				utils.RespondError(c, http.StatusBadRequest, "Cannot demote the last admin, at least one admin must remain", utils.ErrCannotDemoteLastAdmin)
				return
			}
		}
		user.Type = req.Type
	}
	if req.Password != "" {
		hashedPassword, err := utils.HashPassword(req.Password)
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Failed to hash password", "HASH_ERROR")
			return
		}
		user.Password = hashedPassword
	}
	if req.ChangeAsLogin != nil {
		user.ChangeAsLogin = *req.ChangeAsLogin
	}

	// Save user
	if err := ctrl.DB.Save(&user).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to update user", "DB_ERROR")
		return
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "User updated successfully",
	})
}

// DeleteUser deletes a user
func (ctrl *AdminController) DeleteUser(c *gin.Context) {
	userID := c.Param("user_id")
	uid, err := uuid.Parse(userID)
	if err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// Find user
	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", utils.ErrUserNotFound)
		return
	}

	// An admin cannot delete their own account.
	if currentUserID := c.GetString("user_id"); currentUserID != "" && currentUserID == user.ID.String() {
		utils.RespondError(c, http.StatusBadRequest, "You cannot delete your own account", utils.ErrCannotDeleteSelf)
		return
	}

	// Keep the last user in the database: never allow deleting the only account.
	var totalCount int64
	if err := ctrl.DB.Model(&models.User{}).Count(&totalCount).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete user", "DB_ERROR")
		return
	}
	if totalCount <= 1 {
		utils.RespondError(c, http.StatusBadRequest, "Cannot delete the last user, at least one user must remain", utils.ErrCannotDeleteLastUser)
		return
	}

	// The remaining account must always be an admin: never delete the last admin.
	if user.Type == "admin" {
		var adminCount int64
		if err := ctrl.DB.Model(&models.User{}).Where("type = ?", "admin").Count(&adminCount).Error; err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Failed to delete user", "DB_ERROR")
			return
		}
		if adminCount <= 1 {
			utils.RespondError(c, http.StatusBadRequest, "Cannot delete the last admin, at least one admin must remain", utils.ErrCannotDeleteLastAdmin)
			return
		}
	}

	// Collect S3 object keys from the records that will be deleted so their
	// files can be removed from storage too.
	var files []string
	var userAttendance []models.Attendance
	if err := ctrl.DB.Select("photo", "file").Where("user_id = ?", uid).
		Find(&userAttendance).Error; err == nil {
		for _, rec := range userAttendance {
			if rec.Photo != nil {
				files = append(files, *rec.Photo)
			}
			if rec.File != nil {
				files = append(files, *rec.File)
			}
		}
	}

	// Delete the user together with all of their attendance/absence records.
	// Records that this user signed/verified are kept, but their verifier is
	// cleared (becomes "unknown") so signed history is never lost.
	if err := ctrl.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Attendance{}).
			Where("verify_by = ?", uid).
			Update("verify_by", nil).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ?", uid).
			Delete(&models.Attendance{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.User{}, "id = ?", uid).Error
	}); err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete user", "DB_ERROR")
		return
	}

	// Remove orphaned files from S3 (best effort, failures are logged by s3).
	for _, key := range files {
		if key != "" {
			s3.DeleteFile(context.Background(), key)
		}
	}

	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"message": "User deleted successfully",
	})
}
