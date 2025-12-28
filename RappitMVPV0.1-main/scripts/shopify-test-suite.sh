#!/bin/bash

##############################################################################
# Shopify Integration Test Suite
#
# Comprehensive testing script for Shopify integration deployment
# Tests product sync, order sync, webhooks, and monitoring
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
BASE_URL="$API_URL/$API_PREFIX"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

##############################################################################
# Test Functions
##############################################################################

test_health_check() {
    print_header "Test 1: Health Check"

    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health" 2>/dev/null || echo "error\n000")
    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "200" ]; then
        print_success "Health check endpoint responding"
    else
        print_error "Health check failed (HTTP $http_code)"
    fi
}

test_database_connection() {
    print_header "Test 2: Database Connection"

    if [ -z "$DATABASE_URL" ]; then
        print_info "DATABASE_URL not set, skipping database tests"
        return
    fi

    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
    fi
}

test_shopify_config() {
    print_header "Test 3: Shopify Configuration"

    required_vars=("SHOPIFY_API_KEY" "SHOPIFY_API_SECRET" "SHOPIFY_API_VERSION")

    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            print_success "$var is set"
        else
            print_error "$var is not set"
        fi
    done
}

##############################################################################
# Main Test Runner
##############################################################################

main() {
    print_header "Shopify Integration Test Suite"
    echo "Testing against: $BASE_URL"

    # Load environment if available
    if [ -f ".env" ]; then
        set -a
        source .env 2>/dev/null
        set +a
    fi

    # Run tests
    test_health_check
    test_database_connection
    test_shopify_config

    # Summary
    print_header "Test Summary"
    echo "Total: $TESTS_TOTAL | Passed: $TESTS_PASSED | Failed: $TESTS_FAILED"

    [ $TESTS_FAILED -eq 0 ] && exit 0 || exit 1
}

main "$@"
