package notification

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/asn1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"time"

	"golang.org/x/crypto/hkdf"
)

// SendWebPush delivers an encrypted Web Push message (RFC 8291 aes128gcm +
// RFC 8292 VAPID) to a single subscription. It reports whether the
// subscription is gone (HTTP 404/410) so the caller can drop it.
func SendWebPush(endpoint, p256dhB64, authB64 string, payload []byte, vapidPubB64, vapidPrivB64, subject string) (expired bool, err error) {
	clientPub, err := base64.RawURLEncoding.DecodeString(p256dhB64)
	if err != nil || len(clientPub) != 65 || clientPub[0] != 0x04 {
		return false, fmt.Errorf("invalid p256dh key: %w", err)
	}
	if !elliptic.P256().IsOnCurve(
		big.NewInt(0).SetBytes(clientPub[1:33]),
		big.NewInt(0).SetBytes(clientPub[33:65]),
	) {
		return false, fmt.Errorf("p256dh key is not on the P-256 curve")
	}
	authSecret, err := base64.RawURLEncoding.DecodeString(authB64)
	if err != nil || len(authSecret) != 16 {
		return false, fmt.Errorf("invalid auth secret: %w", err)
	}

	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return false, fmt.Errorf("push endpoint must be an https URL")
	}

	// Ephemeral ECDH keypair on P-256.
	ephPriv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return false, err
	}
	ephPub := elliptic.Marshal(elliptic.P256(), ephPriv.X, ephPriv.Y)

	x, _ := elliptic.P256().ScalarMult(
		big.NewInt(0).SetBytes(clientPub[1:33]),
		big.NewInt(0).SetBytes(clientPub[33:65]),
		padScalar(ephPriv.D.Bytes()),
	)
	shared := padScalar(x.Bytes())

	// IKM = HKDF-Expand(HKDF-Extract(auth, shared), key_info, 32)
	prkKey := hkdf.Extract(sha256.New, shared, authSecret)
	keyInfo := append([]byte("WebPush: info\x00"), append(clientPub, ephPub...)...)
	ikm := make([]byte, 32)
	if _, err := io.ReadFull(hkdf.Expand(sha256.New, prkKey, keyInfo), ikm); err != nil {
		return false, err
	}

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return false, err
	}

	prk := hkdf.Extract(sha256.New, ikm, salt)
	cek := make([]byte, 16)
	if _, err := io.ReadFull(hkdf.Expand(sha256.New, prk, []byte("Content-Encoding: aes128gcm\x00")), cek); err != nil {
		return false, err
	}
	nonce := make([]byte, 12)
	if _, err := io.ReadFull(hkdf.Expand(sha256.New, prk, []byte("Content-Encoding: nonce\x00")), nonce); err != nil {
		return false, err
	}

	block, err := aes.NewCipher(cek)
	if err != nil {
		return false, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return false, err
	}
	// Single record: plaintext || 0x02 delimiter, record size 4096.
	ciphertext := gcm.Seal(nil, nonce, append(payload, 0x02), nil)

	var record bytes.Buffer
	record.Write(salt)
	var rs [4]byte
	binary.BigEndian.PutUint32(rs[:], 4096)
	record.Write(rs[:])
	record.WriteByte(byte(len(ephPub)))
	record.Write(ephPub)
	record.Write(ciphertext)

	req, err := http.NewRequest(http.MethodPost, endpoint, &record)
	if err != nil {
		return false, err
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", "86400")

	audience := u.Scheme + "://" + u.Host
	token, err := vapidToken(audience, subject, vapidPubB64, vapidPrivB64)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", "vapid t="+token+", k="+vapidPubB64)
	req.Header.Set("Crypto-Key", "dh="+base64.RawURLEncoding.EncodeToString(ephPub))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return true, nil
	}
	if resp.StatusCode >= 400 {
		return false, fmt.Errorf("push endpoint returned %d", resp.StatusCode)
	}
	return false, nil
}

type ecdsaSignature struct {
	R, S *big.Int
}

// vapidToken builds a short-lived VAPID JWT (ES256) for the given audience.
func vapidToken(audience, subject, pubB64, privB64 string) (string, error) {
	privBytes, err := base64.RawURLEncoding.DecodeString(privB64)
	if err != nil || len(privBytes) != 32 {
		return "", fmt.Errorf("invalid vapid private key: %w", err)
	}
	priv := &ecdsa.PrivateKey{
		PublicKey: ecdsa.PublicKey{Curve: elliptic.P256()},
		D:         big.NewInt(0).SetBytes(privBytes),
	}
	priv.PublicKey.X, priv.PublicKey.Y = elliptic.P256().ScalarBaseMult(privBytes)

	header, _ := json.Marshal(map[string]string{"typ": "JWT", "alg": "ES256"})
	claims, _ := json.Marshal(map[string]any{
		"aud": audience,
		"exp": time.Now().Add(12 * time.Hour).Unix(),
		"sub": subject,
	})
	enc := base64.RawURLEncoding
	signingInput := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)

	hash := sha256.Sum256([]byte(signingInput))
	sigDER, err := ecdsa.SignASN1(rand.Reader, priv, hash[:])
	if err != nil {
		return "", err
	}
	var sig ecdsaSignature
	if _, err := asn1.Unmarshal(sigDER, &sig); err != nil {
		return "", err
	}
	raw := append(padScalar(sig.R.Bytes()), padScalar(sig.S.Bytes())...)
	return signingInput + "." + enc.EncodeToString(raw), nil
}

func padScalar(b []byte) []byte {
	if len(b) >= 32 {
		return b[len(b)-32:]
	}
	padded := make([]byte, 32)
	copy(padded[32-len(b):], b)
	return padded
}
