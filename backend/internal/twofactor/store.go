package twofactor

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Challenge is a short-lived token binding a second-factor or passkey
// ceremony to a user. SessionData carries marshaled webauthn session data
// for passkey flows and is empty for TOTP login challenges.
type Challenge struct {
	Token       string
	UserID      uuid.UUID
	Kind        string
	SessionData []byte
	Expires     time.Time
}

const (
	KindLogin2FA        = "login-2fa"
	KindPasskeyRegister = "passkey-register"
	KindPasskeyLogin    = "passkey-login"
)

const challengeTTL = 5 * time.Minute

var (
	mu         sync.Mutex
	challenges = map[string]Challenge{}
)

func newToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("twofactor: no randomness")
	}
	return hex.EncodeToString(b)
}

// New creates a challenge for the user and returns its token.
func New(userID uuid.UUID, kind string, sessionData []byte) string {
	mu.Lock()
	defer mu.Unlock()
	token := newToken()
	challenges[token] = Challenge{
		Token:       token,
		UserID:      userID,
		Kind:        kind,
		SessionData: sessionData,
		Expires:     time.Now().Add(challengeTTL),
	}
	return token
}

// Take returns and consumes the challenge if it exists, matches the kind,
// and has not expired.
func Take(token, kind string) (Challenge, bool) {
	mu.Lock()
	defer mu.Unlock()
	ch, ok := challenges[token]
	if !ok || ch.Kind != kind || time.Now().After(ch.Expires) {
		delete(challenges, token)
		return Challenge{}, false
	}
	delete(challenges, token)
	return ch, true
}

// Peek returns the challenge without consuming it.
func Peek(token, kind string) (Challenge, bool) {
	mu.Lock()
	defer mu.Unlock()
	ch, ok := challenges[token]
	if !ok || ch.Kind != kind || time.Now().After(ch.Expires) {
		delete(challenges, token)
		return Challenge{}, false
	}
	return ch, true
}
