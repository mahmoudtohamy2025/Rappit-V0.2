#!/bin/bash

# Test Auth Flow Script
# Tests the complete authentication flow using curl

echo "🧪 Testing Rappit Authentication Flow"
echo "======================================"
echo ""

# Configuration
API_URL="http://localhost:3000/api"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "📍 API URL: $API_URL"
echo "📍 Backend URL: $BACKEND_URL"
echo ""

# Test 1: Login
echo "Test 1: POST /api/auth/login"
echo "----------------------------"

LOGIN_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }')

echo "$LOGIN_RESPONSE" | head -20

# Extract access_token cookie
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie: access_token" | sed 's/.*access_token=\([^;]*\).*/\1/')

if [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ access_token cookie set: ${ACCESS_TOKEN:0:20}..."
else
  echo "❌ No access_token cookie found"
fi

echo ""
echo ""

# Test 2: Switch Org
echo "Test 2: POST /api/account/switch-org"
echo "-------------------------------------"

SWITCH_RESPONSE=$(curl -s -i -X POST "$API_URL/account/switch-org" \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=$ACCESS_TOKEN" \
  -d '{
    "orgId": "org_1"
  }')

echo "$SWITCH_RESPONSE" | head -20

# Extract selected_org cookie
SELECTED_ORG=$(echo "$SWITCH_RESPONSE" | grep -i "set-cookie: selected_org" | sed 's/.*selected_org=\([^;]*\).*/\1/')

if [ -n "$SELECTED_ORG" ]; then
  echo "✅ selected_org cookie set: $SELECTED_ORG"
else
  echo "❌ No selected_org cookie found"
fi

echo ""
echo ""

# Test 3: Logout
echo "Test 3: POST /api/auth/logout"
echo "-----------------------------"

LOGOUT_RESPONSE=$(curl -s -i -X POST "$API_URL/auth/logout" \
  -H "Cookie: access_token=$ACCESS_TOKEN; selected_org=$SELECTED_ORG")

echo "$LOGOUT_RESPONSE" | head -15

# Check if cookies cleared
CLEARED=$(echo "$LOGOUT_RESPONSE" | grep -i "set-cookie.*Max-Age=0")

if [ -n "$CLEARED" ]; then
  echo "✅ Cookies cleared successfully"
else
  echo "❌ Cookies not cleared"
fi

echo ""
echo ""
echo "🎉 Test complete!"
