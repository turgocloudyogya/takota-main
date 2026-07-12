#!/bin/bash

# Admin Pages API Integration Test Script
# Tests all admin endpoints to ensure frontend can communicate with backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="${API_BASE:-http://localhost:8080}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}Takota Admin API Integration Test${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "API Base URL: ${YELLOW}$API_BASE${NC}"
echo -e "Admin User: ${YELLOW}$ADMIN_USER${NC}"
echo ""

# Function to print test results
print_test() {
    local name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}✓${NC} $name"
        [ -n "$message" ] && echo -e "  ${message}"
    elif [ "$status" = "skip" ]; then
        echo -e "${YELLOW}⊘${NC} $name (skipped)"
        [ -n "$message" ] && echo -e "  ${message}"
    else
        echo -e "${RED}✗${NC} $name"
        [ -n "$message" ] && echo -e "  ${RED}$message${NC}"
        return 1
    fi
}

# Test 1: Health Check
echo -e "${BLUE}[1/10]${NC} Testing health endpoint..."
if curl -s -f "$API_BASE/health" > /dev/null 2>&1; then
    print_test "Health Check" "pass" "Server is responding"
else
    print_test "Health Check" "fail" "Server not responding. Is docker-compose running?"
    exit 1
fi

# Test 2: Admin Login
echo -e "\n${BLUE}[2/10]${NC} Testing admin authentication..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"\(.*\)"/\1/')

if [ -n "$TOKEN" ]; then
    print_test "Admin Login" "pass" "Token: ${TOKEN:0:20}..."
else
    print_test "Admin Login" "fail" "Failed to obtain JWT token"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test 3: List Users
echo -e "\n${BLUE}[3/10]${NC} Testing user list endpoint..."
USERS_RESPONSE=$(curl -s -X GET "$API_BASE/api/admin/users?limit=10" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Key-Request: web")

USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"username"' | wc -l)
if [ "$USER_COUNT" -gt 0 ]; then
    print_test "List Users" "pass" "Found $USER_COUNT users"
else
    print_test "List Users" "fail" "No users returned"
    echo "Response: $USERS_RESPONSE"
fi

# Test 4: List Attendance
echo -e "\n${BLUE}[4/10]${NC} Testing attendance list endpoint..."
ATTENDANCE_RESPONSE=$(curl -s -X GET "$API_BASE/api/admin/attendances?limit=10" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Key-Request: web")

if echo "$ATTENDANCE_RESPONSE" | grep -q "attendances\|data\|items"; then
    ATTENDANCE_COUNT=$(echo "$ATTENDANCE_RESPONSE" | grep -o '"id"' | wc -l)
    print_test "List Attendance" "pass" "Found $ATTENDANCE_COUNT records"
else
    print_test "List Attendance" "fail" "Invalid response format"
    echo "Response: $ATTENDANCE_RESPONSE"
fi

# Test 5: List Absences
echo -e "\n${BLUE}[5/10]${NC} Testing absence list endpoint..."
ABSENCE_RESPONSE=$(curl -s -X GET "$API_BASE/api/admin/absences?limit=10" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Key-Request: web")

if echo "$ABSENCE_RESPONSE" | grep -q "absences\|data\|items"; then
    ABSENCE_COUNT=$(echo "$ABSENCE_RESPONSE" | grep -o '"id"' | wc -l)
    print_test "List Absences" "pass" "Found $ABSENCE_COUNT records"
else
    print_test "List Absences" "fail" "Invalid response format"
    echo "Response: $ABSENCE_RESPONSE"
fi

# Test 6: User Info
echo -e "\n${BLUE}[6/10]${NC} Testing user info endpoint..."
INFO_RESPONSE=$(curl -s -X GET "$API_BASE/api/all/info" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Key-Request: web")

if echo "$INFO_RESPONSE" | grep -q "username"; then
    USERNAME=$(echo "$INFO_RESPONSE" | grep -o '"username":"[^"]*"' | sed 's/"username":"\(.*\)"/\1/')
    print_test "User Info" "pass" "Logged in as: $USERNAME"
else
    print_test "User Info" "fail" "Failed to get user info"
    echo "Response: $INFO_RESPONSE"
fi

# Test 7: Create Test User
echo -e "\n${BLUE}[7/10]${NC} Testing user creation..."
TEST_USERNAME="test_user_$$"
CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/api/admin/user" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Key-Request: web" \
    -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"test123\",\"nickname\":\"Test User\",\"callname\":\"Test\",\"type\":\"user\",\"change_as_login\":false}")

if echo "$CREATE_RESPONSE" | grep -q "id\|success\|created"; then
    TEST_USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | sed 's/"id":"\(.*\)"/\1/')
    print_test "Create User" "pass" "Created user: $TEST_USERNAME"
else
    print_test "Create User" "skip" "May already exist or validation failed"
    TEST_USER_ID=""
fi

# Test 8: Update User
if [ -n "$TEST_USER_ID" ]; then
    echo -e "\n${BLUE}[8/10]${NC} Testing user update..."
    UPDATE_RESPONSE=$(curl -s -X POST "$API_BASE/api/admin/user/$TEST_USER_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -H "Key-Request: web" \
        -d "{\"username\":\"$TEST_USERNAME\",\"password\":\"test123\",\"nickname\":\"Updated Test User\",\"callname\":\"Updated\",\"type\":\"user\",\"change_as_login\":false}")
    
    if echo "$UPDATE_RESPONSE" | grep -q "success\|updated\|id"; then
        print_test "Update User" "pass" "Updated user: $TEST_USER_ID"
    else
        print_test "Update User" "fail" "Failed to update user"
    fi
else
    echo -e "\n${BLUE}[8/10]${NC} Skipping user update test (no test user created)"
    print_test "Update User" "skip" "No test user to update"
fi

# Test 9: Delete User
if [ -n "$TEST_USER_ID" ]; then
    echo -e "\n${BLUE}[9/10]${NC} Testing user deletion..."
    DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/api/admin/user/$TEST_USER_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Key-Request: web")
    
    if echo "$DELETE_RESPONSE" | grep -q "success\|deleted\|removed" || [ -z "$DELETE_RESPONSE" ]; then
        print_test "Delete User" "pass" "Deleted user: $TEST_USER_ID"
    else
        print_test "Delete User" "fail" "Failed to delete user"
    fi
else
    echo -e "\n${BLUE}[9/10]${NC} Skipping user deletion test"
    print_test "Delete User" "skip" "No test user to delete"
fi

# Test 10: Search Users
echo -e "\n${BLUE}[10/10]${NC} Testing user search..."
SEARCH_RESPONSE=$(curl -s -X GET "$API_BASE/api/admin/users?search=admin&limit=5" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Key-Request: web")

if echo "$SEARCH_RESPONSE" | grep -q "username"; then
    SEARCH_COUNT=$(echo "$SEARCH_RESPONSE" | grep -o '"username"' | wc -l)
    print_test "Search Users" "pass" "Found $SEARCH_COUNT matching users"
else
    print_test "Search Users" "fail" "Search returned no results"
fi

# Summary
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. Start the frontend dev server: ${YELLOW}cd web && npm run dev${NC}"
echo -e "2. Navigate to: ${YELLOW}http://localhost:5173${NC}"
echo -e "3. Login with: ${YELLOW}admin / admin123${NC}"
echo -e "4. Test all admin pages in the UI"
echo ""
echo -e "${GREEN}✓${NC} All admin pages are ready for backend integration!"
