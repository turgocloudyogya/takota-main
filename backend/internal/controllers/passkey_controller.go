package controllers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/carakan/takota/internal/config"
	"github.com/carakan/takota/internal/models"
	"github.com/carakan/takota/internal/twofactor"
	"github.com/carakan/takota/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PasskeyController struct {
	DB     *gorm.DB
	Config *config.Config
}

// webauthnUser adapts a User plus stored credentials to the library interface.
type webauthnUser struct {
	user        models.User
	credentials []webauthn.Credential
}

func (u webauthnUser) WebAuthnID() []byte                         { return u.user.ID[:] }
func (u webauthnUser) WebAuthnName() string                       { return u.user.Username }
func (u webauthnUser) WebAuthnDisplayName() string                { return u.user.Nickname }
func (u webauthnUser) WebAuthnCredentials() []webauthn.Credential { return u.credentials }
func (u webauthnUser) WebAuthnIcon() string                       { return "" }

func loadWebauthnUser(db *gorm.DB, user models.User) (webauthnUser, error) {
	var rows []models.WebauthnCredential
	if err := db.Where("user_id = ?", user.ID).Find(&rows).Error; err != nil {
		return webauthnUser{}, err
	}
	creds := make([]webauthn.Credential, 0, len(rows))
	for _, row := range rows {
		var cred webauthn.Credential
		if err := json.Unmarshal([]byte(row.Credential), &cred); err != nil {
			continue
		}
		creds = append(creds, cred)
	}
	return webauthnUser{user: user, credentials: creds}, nil
}

// newWebAuthnForRequest builds an RP instance bound to the request host so
// passkeys work on localhost, tailnet, and ngrok alike without config edits.
// The origin is read from the Origin/Referer header (what the browser used
// for the ceremony), NOT from Host - reverse proxies may rewrite Host.
func newWebAuthnForRequest(c *gin.Context, cfg *config.Config) (*webauthn.WebAuthn, error) {
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if origin == "" {
		if ref := strings.TrimSpace(c.GetHeader("Referer")); ref != "" {
			if u, err := url.Parse(ref); err == nil && u.Host != "" {
				origin = u.Scheme + "://" + u.Host
			}
		}
	}
	if origin == "" {
		host := c.Request.Host
		scheme := "https"
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = strings.ToLower(strings.Split(proto, ",")[0])
		} else if c.Request.TLS == nil {
			scheme = "http"
		}
		origin = scheme + "://" + host
	}

	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, fmt.Errorf("cannot determine request origin")
	}

	rpid := u.Host
	if h, _, err := net.SplitHostPort(u.Host); err == nil {
		rpid = h
	}

	origins := []string{origin}
	seen := map[string]bool{origin: true}
	for _, extra := range cfg.Security.WebauthnOrigins {
		extra = strings.TrimSpace(extra)
		if extra != "" && !seen[extra] {
			seen[extra] = true
			origins = append(origins, extra)
		}
	}

	return webauthn.New(&webauthn.Config{
		RPDisplayName: "Takota",
		RPID:          rpid,
		RPOrigins:     origins,
	})
}

func marshalSessionData(session *webauthn.SessionData) []byte {
	b, _ := json.Marshal(session)
	return b
}

func unmarshalSessionData(raw []byte) (webauthn.SessionData, error) {
	var session webauthn.SessionData
	err := json.Unmarshal(raw, &session)
	return session, err
}

// BeginPasskeyRegistration starts adding a passkey to the logged-in account.
func (ctrl *PasskeyController) BeginPasskeyRegistration(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var user models.User
	if err := ctrl.DB.Where("id = ?", uid).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}

	wu, err := loadWebauthnUser(ctrl.DB, user)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to load credentials", "DB_ERROR")
		return
	}

	wa, err := newWebAuthnForRequest(c, ctrl.Config)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Passkey is not configured", "WEBAUTHN_ERROR")
		return
	}

	creation, session, err := wa.BeginRegistration(wu)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to start registration", "WEBAUTHN_ERROR")
		return
	}

	challenge := twofactor.New(uid, twofactor.KindPasskeyRegister, marshalSessionData(session))
	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"challenge": challenge,
		"options":   creation,
	})
}

// FinishPasskeyRegistration verifies the new passkey and stores it. The
// challenge identifies both the user and the ceremony session. The request
// body must be the raw credential JSON; challenge and name travel via the
// X-Passkey-Challenge header (or query params).
func (ctrl *PasskeyController) FinishPasskeyRegistration(c *gin.Context) {
	challenge := c.GetHeader("X-Passkey-Challenge")
	if challenge == "" {
		challenge = c.Query("challenge")
	}
	name := c.GetHeader("X-Passkey-Name")
	if name == "" {
		name = c.Query("name")
	}
	if challenge == "" {
		utils.RespondError(c, http.StatusBadRequest, "Registration challenge missing", "CHALLENGE_MISSING")
		return
	}

	ch, ok := twofactor.Peek(challenge, twofactor.KindPasskeyRegister)
	if !ok {
		utils.RespondError(c, http.StatusBadRequest, "Registration challenge expired", "CHALLENGE_EXPIRED")
		return
	}

	var user models.User
	if err := ctrl.DB.Where("id = ?", ch.UserID).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}
	wu, err := loadWebauthnUser(ctrl.DB, user)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to load credentials", "DB_ERROR")
		return
	}
	wa, err := newWebAuthnForRequest(c, ctrl.Config)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Passkey is not configured", "WEBAUTHN_ERROR")
		return
	}
	session, err := unmarshalSessionData(ch.SessionData)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Registration challenge expired", "CHALLENGE_EXPIRED")
		return
	}

	parsed, err := protocol.ParseCredentialCreationResponse(c.Request)
	if err != nil {
		log.Printf("passkey register parse failed: %v", err)
		utils.RespondError(c, http.StatusBadRequest, "Invalid credential response", "INVALID_CREDENTIAL")
		return
	}
	credential, err := wa.CreateCredential(wu, session, parsed)
	if err != nil {
		log.Printf("passkey register verify failed: %v", err)
		utils.RespondError(c, http.StatusBadRequest, "Passkey verification failed", "WEBAUTHN_ERROR")
		return
	}

	credJSON, _ := json.Marshal(credential)
	row := models.WebauthnCredential{
		// credential.ID holds raw bytes in this library version, so use
		// its base64url form as the text primary key.
		ID:         base64.RawURLEncoding.EncodeToString(credential.ID),
		UserID:     user.ID,
		Credential: string(credJSON),
		Name:       name,
	}
	if err := ctrl.DB.Create(&row).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to save passkey", "DB_ERROR")
		return
	}

	resp := gin.H{"message": "Passkey added successfully"}
	if !user.PasskeyEnabled {
		plain, hashes, err := twofactor.GenerateBackupCodes()
		if err != nil {
			utils.RespondError(c, http.StatusInternalServerError, "Failed to generate backup codes", "BACKUP_FAILED")
			return
		}
		ctrl.DB.Model(&models.User{}).Where("id = ?", user.ID).
			Select("passkey_enabled", "backup_codes").
			Updates(&models.User{PasskeyEnabled: true, BackupCodes: hashes})
		resp["backup_codes"] = plain
		resp["message"] = "Passkey enabled. Save these backup codes - each works once and they will never be shown again"
	}

	twofactor.Take(challenge, twofactor.KindPasskeyRegister)
	utils.RespondSuccess(c, http.StatusOK, resp)
}

// ListPasskeys returns the logged-in user's passkeys (metadata only).
func (ctrl *PasskeyController) ListPasskeys(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))

	var rows []models.WebauthnCredential
	if err := ctrl.DB.Where("user_id = ?", uid).Order("created_at ASC").Find(&rows).Error; err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to load passkeys", "DB_ERROR")
		return
	}

	items := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		items = append(items, gin.H{
			"id":         row.ID,
			"name":       row.Name,
			"created_at": row.CreatedAt,
		})
	}
	utils.RespondSuccess(c, http.StatusOK, gin.H{"passkeys": items})
}

// DeletePasskey removes one passkey. The last removal also clears the flag.
func (ctrl *PasskeyController) DeletePasskey(c *gin.Context) {
	userID, _ := c.Get("user_id")
	uid, _ := uuid.Parse(userID.(string))
	credID := c.Param("id")

	res := ctrl.DB.Where("id = ? AND user_id = ?", credID, uid).Delete(&models.WebauthnCredential{})
	if res.Error != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to delete passkey", "DB_ERROR")
		return
	}
	if res.RowsAffected == 0 {
		utils.RespondError(c, http.StatusNotFound, "Passkey not found", "PASSKEY_NOT_FOUND")
		return
	}

	var remaining int64
	ctrl.DB.Model(&models.WebauthnCredential{}).Where("user_id = ?", uid).Count(&remaining)
	if remaining == 0 {
		ctrl.DB.Model(&models.User{}).Where("id = ?", uid).Update("passkey_enabled", false)
	}
	utils.RespondSuccess(c, http.StatusOK, gin.H{"message": "Passkey removed"})
}

type PasskeyLoginBeginRequest struct {
	Username string `json:"username" binding:"required"`
}

// BeginPasskeyLogin starts a passwordless login for a user with passkeys.
func (ctrl *PasskeyController) BeginPasskeyLogin(c *gin.Context) {
	var req PasskeyLoginBeginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Username required", "INVALID_REQUEST")
		return
	}

	var user models.User
	if err := ctrl.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		// Same generic message as password login to avoid user enumeration.
		utils.RespondError(c, http.StatusBadRequest, "User not found", "USER_NOT_FOUND")
		return
	}
	if !user.PasskeyEnabled {
		utils.RespondError(c, http.StatusBadRequest, "Passkey login is not enabled for this account", "PASSKEY_NOT_ENABLED")
		return
	}

	wu, err := loadWebauthnUser(ctrl.DB, user)
	if err != nil || len(wu.credentials) == 0 {
		utils.RespondError(c, http.StatusBadRequest, "Passkey login is not enabled for this account", "PASSKEY_NOT_ENABLED")
		return
	}

	wa, err := newWebAuthnForRequest(c, ctrl.Config)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Passkey is not configured", "WEBAUTHN_ERROR")
		return
	}

	assertion, session, err := wa.BeginLogin(wu)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to start passkey login", "WEBAUTHN_ERROR")
		return
	}

	challenge := twofactor.New(user.ID, twofactor.KindPasskeyLogin, marshalSessionData(session))
	utils.RespondSuccess(c, http.StatusOK, gin.H{
		"challenge": challenge,
		"options":   assertion,
	})
}

// FinishPasskeyLogin verifies the assertion and issues a full session.
// The request body must be the raw assertion JSON; the challenge travels
// via the X-Passkey-Challenge header (or query param).
func (ctrl *PasskeyController) FinishPasskeyLogin(c *gin.Context) {
	challenge := c.GetHeader("X-Passkey-Challenge")
	if challenge == "" {
		challenge = c.Query("challenge")
	}
	if challenge == "" {
		utils.RespondError(c, http.StatusBadRequest, "Login challenge missing", "CHALLENGE_MISSING")
		return
	}

	ch, ok := twofactor.Take(challenge, twofactor.KindPasskeyLogin)
	if !ok {
		utils.RespondError(c, http.StatusBadRequest, "Login challenge expired", "CHALLENGE_EXPIRED")
		return
	}

	var user models.User
	if err := ctrl.DB.Where("id = ?", ch.UserID).First(&user).Error; err != nil {
		utils.RespondError(c, http.StatusNotFound, "User not found", "USER_NOT_FOUND")
		return
	}
	wu, err := loadWebauthnUser(ctrl.DB, user)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Failed to load credentials", "DB_ERROR")
		return
	}
	wa, err := newWebAuthnForRequest(c, ctrl.Config)
	if err != nil {
		utils.RespondError(c, http.StatusInternalServerError, "Passkey is not configured", "WEBAUTHN_ERROR")
		return
	}
	session, err := unmarshalSessionData(ch.SessionData)
	if err != nil {
		utils.RespondError(c, http.StatusBadRequest, "Login challenge expired", "CHALLENGE_EXPIRED")
		return
	}

	credential, err := wa.FinishLogin(wu, session, c.Request)
	if err != nil {
		log.Printf("passkey login verify failed: %v", err)
		utils.RespondError(c, http.StatusUnauthorized, "Passkey verification failed", "WEBAUTHN_ERROR")
		return
	}

	// Persist updated sign count.
	if credJSON, err := json.Marshal(credential); err == nil {
		ctrl.DB.Model(&models.WebauthnCredential{}).
			Where("id = ? AND user_id = ?", string(credential.ID), user.ID).
			Update("credential", string(credJSON))
	}

	issueSessionForUser(c, ctrl.DB, ctrl.Config, &user)
}
