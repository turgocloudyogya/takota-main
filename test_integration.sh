#!/bin/bash

# Script untuk test comprehensive integrasi frontend-backend Takota
# Semua endpoint user (/main/*) dan admin (/admin/*)

BASE_URL="http://localhost:8080"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Takota Comprehensive Test Script"
echo "=================================="
echo ""

# Counter untuk test results
PASSED=0
FAILED=0

# Helper function untuk test
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local token="$4"
    local data="$5"
    local expect_code="${6:-200}"
    
    echo -n "Testing $name... "
    
    local curl_cmd="curl -s -w '\n%{http_code}' -X $method '$BASE_URL$endpoint'"
    
    if [ -n "$token" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $token' -H 'key-request: web'"
    fi
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    response=$(eval $curl_cmd)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expect_code" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected $expect_code, got $http_code)"
        echo "Response: $body"
        ((FAILED++))
        return 1
    fi
}

# ============================================
# 1. Test Health Check
# ============================================
echo "=== 1. Health Check ==="
test_endpoint "Health Check" "GET" "/health" "" "" "200"
echo ""

# ============================================
# 2. Test Authentication
# ============================================
echo "=== 2. Authentication ==="

# Login Admin
echo -n "Login Admin... "
admin_response=$(curl -s -X POST "$BASE_URL/api/auth" \
    -H "Content-Type: application/json" \
    -H "key-request: web" \
    -d '{"username":"admin","password":"admin123"}')

ADMIN_TOKEN=$(echo "$admin_response" | jq -r '.token // empty')
if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $admin_response"
    ((FAILED++))
fi

# Login User
echo -n "Login User... "
user_response=$(curl -s -X POST "$BASE_URL/api/auth" \
    -H "Content-Type: application/json" \
    -H "key-request: web-user" \
    -d '{"username":"user001","password":"user123"}')

USER_TOKEN=$(echo "$user_response" | jq -r '.token // empty')
if [ -n "$USER_TOKEN" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $user_response"
    ((FAILED++))
fi

echo ""

# ============================================
# 3. Test User Endpoints (/api/user/*)
# ============================================
echo "=== 3. User Endpoints ==="

# User Home/Dashboard
test_endpoint "User Home" "GET" "/api/user/home" "$USER_TOKEN" "" "200"

# User Info (Global)
test_endpoint "User Info" "GET" "/api/all/info" "$USER_TOKEN" "" "200"

# Photos Gallery
test_endpoint "Photos Gallery" "GET" "/api/all/photos?limit=10" "$USER_TOKEN" "" "200"

echo ""

# ============================================
# 4. Test Admin - User Management
# ============================================
echo "=== 4. Admin - User Management ==="

# List Users
test_endpoint "List Users" "GET" "/api/admin/users?limit=50" "$ADMIN_TOKEN" "" "200"

# Create User (with test data)
echo -n "Create Test User... "
create_response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/user" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "key-request: web" \
    -H "Content-Type: application/json" \
    -d '{
        "username":"testuser_'$(date +%s)'",
        "password":"test123",
        "nickname":"Test User Created",
        "callname":"TestUser",
        "type":"user",
        "change_as_login":false
    }')

http_code=$(echo "$create_response" | tail -n1)
body=$(echo "$create_response" | sed '$d')
TEST_USER_ID=$(echo "$body" | jq -r '.data.id // empty')

if [ "$http_code" == "200" ] && [ -n "$TEST_USER_ID" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Created user ID: $TEST_USER_ID)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $body"
    ((FAILED++))
fi

# Update User (if created successfully)
if [ -n "$TEST_USER_ID" ]; then
    test_endpoint "Update User" "POST" "/api/admin/user/$TEST_USER_ID" "$ADMIN_TOKEN" \
        '{"nickname":"Test User Updated","callname":"Updated","type":"user"}' "200"
fi

echo ""

# ============================================
# 5. Test Admin - Attendance Management
# ============================================
echo "=== 5. Admin - Attendance Management ==="

# List Attendances
test_endpoint "List Attendances" "GET" "/api/admin/attendances?limit=50" "$ADMIN_TOKEN" "" "200"

echo ""

# ============================================
# 6. Test Admin - Absence Management
# ============================================
echo "=== 6. Admin - Absence Management ==="

# List Absences
test_endpoint "List Absences" "GET" "/api/admin/absences?limit=50" "$ADMIN_TOKEN" "" "200"

echo ""

# ============================================
# 7. Test Admin - Export
# ============================================
echo "=== 7. Admin - Export Data ==="

# Export to CSV (month name: january, february, etc)
test_endpoint "Export Attendance CSV" "GET" "/api/admin/export?month=july&lang=id" "$ADMIN_TOKEN" "" "200"

echo ""

# ============================================
# 8. Test Authorization (Access Control)
# ============================================
echo "=== 8. Authorization Tests ==="

# User trying to access admin endpoint (should fail)
test_endpoint "User Access Admin (Should Fail)" "GET" "/api/admin/users" "$USER_TOKEN" "" "403"

# Admin trying to access user endpoint (should fail - different role)
test_endpoint "Admin Access User Home (Should Fail)" "GET" "/api/user/home" "$ADMIN_TOKEN" "" "403"

# No token (should fail)
test_endpoint "No Auth Token (Should Fail)" "GET" "/api/user/home" "" "" "401"

echo ""

# ============================================
# 9. Cleanup Test Data
# ============================================
echo "=== 9. Cleanup ==="

# Delete test user if created
if [ -n "$TEST_USER_ID" ]; then
    test_endpoint "Delete Test User" "DELETE" "/api/admin/user/$TEST_USER_ID" "$ADMIN_TOKEN" "" "200"
fi

echo ""

# ============================================
# Summary
# ============================================
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ✗${NC}"
    exit 1
fi
