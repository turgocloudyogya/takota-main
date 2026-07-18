#!/bin/bash

# Test Delete Photo Endpoint
# Usage: ./test-delete-photo.sh

BASE_URL="http://localhost:8080"
PHOTO_ID="test-uuid-here"

echo "🧪 Testing Delete Photo Endpoint"
echo "================================="
echo ""

# Step 1: Login as admin
echo "1️⃣ Login sebagai admin..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login gagal!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login berhasil! Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Get photos list
echo "2️⃣ Mengambil daftar foto..."
PHOTOS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/all/photos?limit=1" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $PHOTOS_RESPONSE"
echo ""

# Extract first photo ID
FIRST_PHOTO_ID=$(echo "$PHOTOS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$FIRST_PHOTO_ID" ]; then
  echo "⚠️  Tidak ada foto untuk dihapus"
  exit 0
fi

echo "📷 Photo ID ditemukan: $FIRST_PHOTO_ID"
echo ""

# Step 3: Test delete endpoint
echo "3️⃣ Testing DELETE endpoint..."
echo "URL: ${BASE_URL}/api/admin/photo"
echo "Body: {\"id\":\"${FIRST_PHOTO_ID}\"}"
echo ""

DELETE_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X DELETE \
  "${BASE_URL}/api/admin/photo" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"${FIRST_PHOTO_ID}\"}")

HTTP_CODE=$(echo "$DELETE_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$DELETE_RESPONSE" | grep -v "HTTP_CODE")

echo "HTTP Status: $HTTP_CODE"
echo "Response Body: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ DELETE berhasil!"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ 404 Not Found - Endpoint tidak ditemukan"
  echo "   Kemungkinan:"
  echo "   - Backend belum di-restart"
  echo "   - Routing belum terupdate"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ 403 Forbidden - Akses ditolak"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ 401 Unauthorized - Token tidak valid"
else
  echo "❌ Error dengan status code: $HTTP_CODE"
fi
