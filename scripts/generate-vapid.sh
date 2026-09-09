#!/usr/bin/env bash
# Generate a VAPID (P-256) keypair for Web Push notifications.
# Needs only openssl - no Go, no npm packages.
#
# Usage:
#   ./scripts/generate-vapid.sh [mailto:admin@example.com] [--write-env]
#
#   --write-env  update (or append) VAPID_* lines in backend/.env
#                (never commit backend/.env - it stays gitignored)
set -euo pipefail

SUBJECT="${1:-mailto:admin@example.com}"
WRITE_ENV=false
if [[ "${1:-}" == "--write-env" || "${2:-}" == "--write-env" ]]; then
  WRITE_ENV=true
fi
if [[ "$SUBJECT" == "--write-env" ]]; then
  SUBJECT="mailto:admin@example.com"
fi

command -v openssl >/dev/null || { echo "error: openssl not found" >&2; exit 1; }

TMPDIR_WORK=$(mktemp -d)
trap 'rm -rf "$TMPDIR_WORK"' EXIT

openssl ecparam -genkey -name prime256v1 -noout -out "$TMPDIR_WORK/key.pem" 2>/dev/null
openssl ec -in "$TMPDIR_WORK/key.pem" -outform DER -out "$TMPDIR_WORK/key.der" 2>/dev/null

# SEC1 DER layout for P-256 is fixed size (121 bytes):
#   7-byte header | 32-byte private | 17-byte curve wrapper | 65-byte public (04 || X || Y)
DER_SIZE=$(wc -c < "$TMPDIR_WORK/key.der" | tr -d ' ')
if [[ "$DER_SIZE" != "121" ]]; then
  echo "error: unexpected DER size ($DER_SIZE bytes), refusing to guess offsets" >&2
  exit 1
fi

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

PRIVATE_KEY=$(dd if="$TMPDIR_WORK/key.der" bs=1 skip=7 count=32 2>/dev/null | b64url)
PUBLIC_KEY=$(tail -c 65 "$TMPDIR_WORK/key.der" | b64url)

if [[ "${#PRIVATE_KEY}" != "43" || "${#PUBLIC_KEY}" != "87" ]]; then
  echo "error: unexpected key lengths (priv=${#PRIVATE_KEY}, pub=${#PUBLIC_KEY})" >&2
  exit 1
fi

upsert_env() {
  local file="$1" var="$2" value="$3"
  if grep -q "^${var}=" "$file"; then
    sed -i "s|^${var}=.*|${var}=${value}|" "$file"
  else
    printf '%s=%s\n' "$var" "$value" >> "$file"
  fi
}

if [[ "$WRITE_ENV" == true ]]; then
  ENV_FILE="$(dirname "$0")/../backend/.env"
  touch "$ENV_FILE"
  if ! grep -q "^VAPID_PUBLIC_KEY=" "$ENV_FILE"; then
    printf '\n# Web Push (VAPID) Configuration\n' >> "$ENV_FILE"
  fi
  upsert_env "$ENV_FILE" "VAPID_PUBLIC_KEY" "$PUBLIC_KEY"
  upsert_env "$ENV_FILE" "VAPID_PRIVATE_KEY" "$PRIVATE_KEY"
  upsert_env "$ENV_FILE" "VAPID_SUBJECT" "$SUBJECT"
  echo "Updated $ENV_FILE (backend restart required)."
  echo
fi

echo "VAPID_PUBLIC_KEY=$PUBLIC_KEY"
echo "VAPID_PRIVATE_KEY=$PRIVATE_KEY"
echo "VAPID_SUBJECT=$SUBJECT"
