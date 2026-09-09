package twofactor

import (
	"crypto/rand"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const backupCodeCount = 10

// backupAlphabet excludes ambiguous characters (0/O, 1/I/L).
const backupAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// GenerateBackupCodes returns plaintext codes in XXXX-XXXX form alongside
// their bcrypt hashes. Plaintext is shown to the user exactly once.
func GenerateBackupCodes() (plain []string, hashes []string, err error) {
	plain = make([]string, 0, backupCodeCount)
	hashes = make([]string, 0, backupCodeCount)
	for len(plain) < backupCodeCount {
		code := randomBackupCode()
		duplicate := false
		for _, existing := range plain {
			if existing == code {
				duplicate = true
				break
			}
		}
		if duplicate {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(normalizeBackupCode(code)), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, err
		}
		plain = append(plain, code)
		hashes = append(hashes, string(hash))
	}
	return plain, hashes, nil
}

func randomBackupCode() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		panic("twofactor: no randomness")
	}
	var sb strings.Builder
	for i, v := range b {
		if i == 4 {
			sb.WriteByte('-')
		}
		sb.WriteByte(backupAlphabet[int(v)%len(backupAlphabet)])
	}
	return sb.String()
}

// normalizeBackupCode canonicalizes user input for comparison.
func normalizeBackupCode(code string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(code), "-", ""))
}

// MatchBackupCode reports whether code matches one of the stored hashes.
func MatchBackupCode(code string, hashes []string) bool {
	normalized := normalizeBackupCode(code)
	if normalized == "" {
		return false
	}
	for _, h := range hashes {
		if bcrypt.CompareHashAndPassword([]byte(h), []byte(normalized)) == nil {
			return true
		}
	}
	return false
}

// ConsumeBackupCode removes the matching hash and reports whether one matched.
func ConsumeBackupCode(code string, hashes []string) ([]string, bool) {
	normalized := normalizeBackupCode(code)
	for i, h := range hashes {
		if bcrypt.CompareHashAndPassword([]byte(h), []byte(normalized)) == nil {
			return append(hashes[:i], hashes[i+1:]...), true
		}
	}
	return hashes, false
}
