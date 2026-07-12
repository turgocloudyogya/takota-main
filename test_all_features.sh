#!/bin/bash

# Takota - Full Feature Test Script
# Tests all user and admin features

set -e

BASE_URL="http://localhost:8080"
RESULTS_FILE="test_results.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

echo "================================================"
echo "  Takota Full Feature Test"
echo "  $(date)"
echo "================================================"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Start logging
exec > >(tee -a "$RESULTS_FILE")
exec 2>&1

echo "=== 1. HEALTH CHECK ===" 
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    pass "Backend Health Check"
else
    fail "Backend Health Check"
    echo "Backend is not running. Please start it first."
    exit 1
fi
echo ""

echo "=== 2. AUTHENTICATION ===" 
# Login as admin
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth" \
    -H "Content-Type: application/json" \
    -H "key-request: web" \
    -d '{"username":"admin","password":"admin123"}')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.token // empty')
if [ -n "$ADMIN_TOKEN" ]; then
    pass "Admin Login"
else
    fail "Admin Login"
    echo "Response: $ADMIN_RESPONSE"
fi

# Login as user
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth" \
    -H "Content-Type: application/json" \
    -H "key-request: web" \
    -d '{"username":"user001","password":"user123"}')

USER_TOKEN=$(echo "$USER_RESPONSE" | jq -r '.token // empty')
if [ -n "$USER_TOKEN" ]; then
    pass "User Login"
else
    fail "User Login"
    echo "Response: $USER_RESPONSE"
fi
echo ""

echo "=== 3. USER ENDPOINTS ===" 
# Get user home
HOME_RESPONSE=$(curl -s "$BASE_URL/api/user/home" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "key-request: web-user")

if echo "$HOME_RESPONSE" | jq -e '.data.greeting_widget' > /dev/null 2>&1; then
    pass "GET /api/user/home - Dashboard"
else
    fail "GET /api/user/home - Dashboard"
    echo "Response: $HOME_RESPONSE"
fi

# Get user info
INFO_RESPONSE=$(curl -s "$BASE_URL/api/all/info" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "key-request: web-user")

if echo "$INFO_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    pass "GET /api/all/info - User Info"
else
    fail "GET /api/all/info - User Info"
    echo "Response: $INFO_RESPONSE"
fi

# Get photos
PHOTOS_RESPONSE=$(curl -s "$BASE_URL/api/all/photos?limit=10" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "key-request: web-user")

if echo "$PHOTOS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    pass "GET /api/all/photos - Photos Gallery"
else
    fail "GET /api/all/photos - Photos Gallery"
    echo "Response: $PHOTOS_RESPONSE"
fi

# Note: Attendance and Absence POST tests require location and file uploads
# which cannot be easily tested via curl. These should be tested manually via browser.
info "POST /api/user/attendance - Requires GPS & photo (manual test)"
info "POST /api/user/absence - Requires form data (manual test)"
echo ""

echo "=== 4. ADMIN - USER MANAGEMENT ===" 
# List users
USERS_RESPONSE=$(curl -s "$BASE_URL/api/admin/users?limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web")

if echo "$USERS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    USER_COUNT=$(echo "$USERS_RESPONSE" | jq '.data | length')
    pass "GET /api/admin/users - List Users ($USER_COUNT users)"
else
    fail "GET /api/admin/users - List Users"
    echo "Response: $USERS_RESPONSE"
fi

# Create test user
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/user" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web" \
    -H "Content-Type: application/json" \
    -d '{
        "nickname": "Test User",
        "callname": "Test",
        "type": "user",
        "username": "testuser'$(date +%s)'",
        "password": "test123",
        "change_as_login": false
    }')

TEST_USER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id // empty')
if [ -n "$TEST_USER_ID" ]; then
    pass "POST /api/admin/user - Create User"
else
    fail "POST /api/admin/user - Create User"
    echo "Response: $CREATE_RESPONSE"
fi

# Update user (if created)
if [ -n "$TEST_USER_ID" ]; then
    UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/user/$TEST_USER_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "key-request: web" \
        -H "Content-Type: application/json" \
        -d '{
            "nickname": "Test User Updated",
            "callname": "TestUpdated",
            "type": "user",
            "username": "testuser'$(date +%s)'",
            "password": "test123new"
        }')
    
    if echo "$UPDATE_RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        pass "POST /api/admin/user/:id - Update User"
    else
        fail "POST /api/admin/user/:id - Update User"
        echo "Response: $UPDATE_RESPONSE"
    fi
fi
echo ""

echo "=== 5. ADMIN - ATTENDANCE MANAGEMENT ===" 
# List attendances
ATT_RESPONSE=$(curl -s "$BASE_URL/api/admin/attendances?limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web")

if echo "$ATT_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    ATT_COUNT=$(echo "$ATT_RESPONSE" | jq '.data | length')
    pass "GET /api/admin/attendances - List Attendances ($ATT_COUNT records)"
else
    fail "GET /api/admin/attendances - List Attendances"
    echo "Response: $ATT_RESPONSE"
fi

info "DELETE /api/admin/attendance - Requires existing attendance ID (manual test)"
echo ""

echo "=== 6. ADMIN - ABSENCE MANAGEMENT ===" 
# List absences
ABS_RESPONSE=$(curl -s "$BASE_URL/api/admin/absences?limit=10" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web")

if echo "$ABS_RESPONSE" | jq -e '.data' > /dev/null 2>&1; then
    ABS_COUNT=$(echo "$ABS_RESPONSE" | jq '.data | length')
    pass "GET /api/admin/absences - List Absences ($ABS_COUNT requests)"
else
    fail "GET /api/admin/absences - List Absences"
    echo "Response: $ABS_RESPONSE"
fi

info "PATCH /api/admin/absence - Requires existing absence ID (manual test)"
echo ""

echo "=== 7. ADMIN - EXPORT ===" 
# Export attendance
EXPORT_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin/export?month=july&lang=id" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web")

HTTP_CODE=$(echo "$EXPORT_RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    pass "GET /api/admin/export - Export CSV"
else
    fail "GET /api/admin/export - Export CSV (HTTP $HTTP_CODE)"
fi
echo ""

echo "=== 8. AUTHORIZATION TESTS ===" 
# User tries to access admin endpoint (should fail)
USER_ADMIN_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin/users" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "key-request: web")

USER_ADMIN_CODE=$(echo "$USER_ADMIN_RESPONSE" | tail -n1)
if [ "$USER_ADMIN_CODE" = "403" ]; then
    pass "User cannot access admin endpoints (403)"
else
    fail "User should NOT access admin endpoints (got HTTP $USER_ADMIN_CODE)"
fi

# Admin tries to access user home (should work - admin can access user endpoints)
ADMIN_USER_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/user/home" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web-user")

ADMIN_USER_CODE=$(echo "$ADMIN_USER_RESPONSE" | tail -n1)
if [ "$ADMIN_USER_CODE" = "403" ]; then
    pass "Admin cannot access user endpoints (403)"
else
    fail "Admin should NOT access user endpoints (got HTTP $ADMIN_USER_CODE)"
fi

# No auth token (should fail)
NO_AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/admin/users" \
    -H "key-request: web")

NO_AUTH_CODE=$(echo "$NO_AUTH_RESPONSE" | tail -n1)
if [ "$NO_AUTH_CODE" = "401" ]; then
    pass "No auth token returns 401"
else
    fail "No auth should return 401 (got HTTP $NO_AUTH_CODE)"
fi
echo ""

echo "=== 9. CLEANUP ===" 
# Delete test user (if created)
if [ -n "$TEST_USER_ID" ]; then
    DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/admin/user/$TEST_USER_ID" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "key-request: web")
    
    if echo "$DELETE_RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
        pass "DELETE /api/admin/user/:id - Delete Test User"
    else
        fail "DELETE /api/admin/user/:id - Delete Test User"
        echo "Response: $DELETE_RESPONSE"
    fi
fi
echo ""

echo "================================================"
echo "  TEST SUMMARY"
echo "================================================"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    exit 1
fi
