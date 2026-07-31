package utils

import "github.com/gin-gonic/gin"

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Status  int    `json:"status"`
	Message string `json:"message"`
	Code    string `json:"code"`
}

// RespondError sends error response in standard format
func RespondError(c *gin.Context, status int, message string, code string) {
	c.JSON(status, ErrorResponse{
		Error: ErrorDetail{
			Status:  status,
			Message: message,
			Code:    code,
		},
	})
}

// RespondSuccess sends success response
func RespondSuccess(c *gin.Context, status int, data interface{}) {
	c.JSON(status, data)
}

// Common error codes
const (
	// Auth errors
	ErrHeaderAuthReq         = "HEADER_AUTH_REQ"
	ErrTokenInvalid          = "TOKEN_UNVALID"
	ErrTokenExpired          = "TOKEN_EXPIRED"
	ErrBodyFillAll           = "BODY_FILL_ALL"
	ErrUserNotFound          = "FN_USER_NOTFOUND"
	ErrUserTryAgain          = "USER_TRYAGAIN"
	ErrUserLockLogin         = "USER_LOCKLOGIN"
	ErrPasswordSameAsOld     = "PASSWORD_DONT_SAME_AS_OLD"
	ErrPasswordRepeatNotMatch = "PASSWORD_REPEAT_NOT_MATC"

	// Authorization errors
	ErrOnlyUser  = "ONLY_USER"
	ErrOnlyAdmin = "ONLY_ADMIN"

	// Data errors
	ErrDataNotFound                   = "DATA_NOT_FOUND"
	ErrInvalidFileFormat              = "INVALID_FILE_FORMAT"
	ErrOutOfRadius                    = "ATTENDANCE_OUT_RADIUS"
	ErrUsernameExists                 = "USERNAME_ALREADY_EXISTS"
	ErrOnlyAbsence                    = "ONLY_ABSENCE"
	ErrInvalidQuery                   = "INVALID_QUERY"
	ErrAttendanceAlreadySubmitted      = "ATTENDANCE_ALREADY_SUBMITTED"
	ErrCannotSubmitAbsenceAfterAttendance = "CANNOT_SUBMIT_ABSENCE_AFTER_ATTENDANCE"
	ErrPendingAbsenceVerification     = "PENDING_ABSENCE_VERIFICATION"
)
