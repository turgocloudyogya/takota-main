#!/bin/bash

# Quick test delete photo endpoint
BASE_URL="http://localhost:8080"

echo "🧪 Quick Delete Photo Endpoint Test"
echo "===================================="
echo ""

# Test 1: Health check
echo "1️⃣ Health check..."
HEALTH=$(curl -s -w "\nHTTP:%{http_code}" "$BASE_URL/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH" | grep "HTTP:" | cut -d: -f2)

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Backend tidak running!"
  echo "   Jalankan: make backend"
  exit 1
fi
echo "✅ Backend running"
echo ""

# Test 2: Login
echo "2️⃣ Login as admin..."
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login gagal!"
  echo "Response: $LOGIN"
  exit 1
fi
echo "✅ Login berhasil"
echo "Token: ${TOKEN:0:30}..."
echo ""

# Test 3: Check endpoint dengan OPTIONS (CORS preflight)
echo "3️⃣ Test endpoint dengan OPTIONS..."
OPTIONS_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X OPTIONS "$BASE_URL/api/admin/photo" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
echo "Response: $OPTIONS_RESP"
echo ""

# Test 4: Test dengan dummy ID untuk cek routing
echo "4️⃣ Test DELETE endpoint dengan dummy ID..."
DUMMY_ID="00000000-0000-0000-0000-000000000000"
DELETE_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X DELETE "$BASE_URL/api/admin/photo" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$DUMMY_ID\"}" 2>&1)

HTTP_CODE=$(echo "$DELETE_RESP" | grep "HTTP:" | cut -d: -f2)
BODY=$(echo "$DELETE_RESP" | grep -v "HTTP:")

echo "HTTP Status: $HTTP_CODE"
echo "Response Body: $BODY"
echo ""

# Interpret results
if [ "$HTTP_CODE" = "404" ]; then
  if echo "$BODY" | grep -q "page not found"; then
    echo "❌ ROUTING ISSUE: Endpoint tidak terdaftar di backend!"
    echo ""
    echo "🔧 SOLUSI:"
    echo "   1. Pastikan backend sudah di-restart setelah perubahan code"
    echo "   2. Jalankan: make backend (di terminal baru)"
    echo "   3. Jalankan test ini lagi"
    echo ""
    echo "🔍 DEBUG:"
    echo "   - Cek file cmd/api/main.go ada: admin.DELETE(\"/photo\", allCtrl.DeletePhoto)"
    echo "   - Pastikan backend di-compile ulang"
  else
    echo "⚠️  404 Not Found: Data tidak ditemukan (normal untuk dummy ID)"
  fi
elif [ "$HTTP_CODE" = "400" ]; then
  echo "⚠️  400 Bad Request: Format request salah atau validasi gagal"
  echo "    (Mungkin normal untuk dummy ID)"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Endpoint WORKING! (tapi dummy ID berhasil terhapus?? unexpected)"
elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ 401 Unauthorized: Token tidak valid"
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ 403 Forbidden: Bukan admin atau password belum diubah"
else
  echo "❓ Unexpected status code: $HTTP_CODE"
fi

echo ""
echo "═══════════════════════════════════════════"

# Test 5: List available routes (if Gin debug mode)
echo ""
echo "5️⃣ Checking registered routes..."
echo "Coba akses endpoint yang tidak ada untuk lihat routing hints:"
NOT_FOUND=$(curl -s -w "\nHTTP:%{http_code}" "$BASE_URL/api/admin/xxxtest" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
echo "$NOT_FOUND"
