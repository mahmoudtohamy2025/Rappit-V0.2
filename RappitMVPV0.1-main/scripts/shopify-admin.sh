#!/bin/bash

##############################################################################
# Shopify Integration Admin Tool
#
# Command-line tool for managing Shopify channels and triggering syncs
##############################################################################

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
BASE_URL="$API_URL/$API_PREFIX"
JWT_TOKEN="${JWT_TOKEN:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

require_auth() {
    if [ -z "$JWT_TOKEN" ]; then
        print_error "JWT_TOKEN not set. Please set JWT_TOKEN environment variable or login first."
        exit 1
    fi
}

##############################################################################
# Commands
##############################################################################

cmd_help() {
    cat << EOF
Shopify Integration Admin Tool

Usage: $0 <command> [options]

Commands:
    list-channels              List all Shopify channels
    create-channel             Create a new Shopify channel
    sync-products <id>         Trigger product sync for channel
    sync-orders <id>           Trigger order sync for channel
    sync-inventory <id>        Trigger inventory sync for channel
    sync-all <id>              Trigger all syncs for channel
    check-health               Check integration health
    show-stats                 Show sync statistics
    login                      Login and get JWT token
    help                       Show this help message

Environment Variables:
    API_URL                    API base URL (default: http://localhost:3000)
    API_PREFIX                 API prefix (default: api/v1)
    JWT_TOKEN                  Authentication token
    DATABASE_URL               Database connection string

Examples:
    # Login first
    export JWT_TOKEN=\$($0 login email@example.com password123)

    # List channels
    $0 list-channels

    # Sync products for a channel
    $0 sync-products abc123-def456-ghi789

    # Check health
    $0 check-health

EOF
}

cmd_login() {
    local email="${1:-}"
    local password="${2:-}"

    if [ -z "$email" ] || [ -z "$password" ]; then
        echo "Usage: $0 login <email> <password>" >&2
        exit 1
    fi

    response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")

    token=$(echo "$response" | jq -r '.access_token // .accessToken // .token')

    if [ -n "$token" ] && [ "$token" != "null" ]; then
        echo "$token"
    else
        print_error "Login failed"
        exit 1
    fi
}

cmd_list_channels() {
    require_auth

    print_header "Shopify Channels"

    response=$(curl -s -X GET "$BASE_URL/channels" \
        -H "Authorization: Bearer $JWT_TOKEN")

    echo "$response" | jq -r '.data[]? | select(.type == "SHOPIFY") |
        "ID: \(.id)\nName: \(.name)\nDomain: \(.config.shopDomain // "N/A")\nActive: \(.isActive)\nLast Sync: \(.lastSyncAt // "Never")\n"'
}

cmd_create_channel() {
    require_auth

    print_header "Create Shopify Channel"

    read -p "Organization ID: " org_id
    read -p "Channel Name: " name
    read -p "Shop Domain (e.g., store.myshopify.com): " shop_domain
    read -p "Access Token: " access_token
    read -p "Webhook Secret (optional): " webhook_secret

    config="{\"shopDomain\":\"$shop_domain\",\"accessToken\":\"$access_token\""
    if [ -n "$webhook_secret" ]; then
        config="$config,\"webhookSecret\":\"$webhook_secret\""
    fi
    config="$config}"

    response=$(curl -s -X POST "$BASE_URL/channels" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\":\"$name\",
            \"type\":\"SHOPIFY\",
            \"organizationId\":\"$org_id\",
            \"config\":$config,
            \"isActive\":true
        }")

    channel_id=$(echo "$response" | jq -r '.id // .data.id')

    if [ -n "$channel_id" ] && [ "$channel_id" != "null" ]; then
        print_success "Channel created: $channel_id"
    else
        print_error "Failed to create channel"
        echo "$response" | jq '.'
        exit 1
    fi
}

cmd_sync_products() {
    require_auth
    local channel_id="$1"

    if [ -z "$channel_id" ]; then
        print_error "Usage: $0 sync-products <channel_id>"
        exit 1
    fi

    print_info "Triggering product sync for channel $channel_id..."

    response=$(curl -s -X POST "$BASE_URL/channels/$channel_id/sync" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type":"product-sync"}')

    if echo "$response" | jq -e '.success // .status' > /dev/null 2>&1; then
        print_success "Product sync triggered"
    else
        print_error "Failed to trigger sync"
        echo "$response" | jq '.'
    fi
}

cmd_sync_orders() {
    require_auth
    local channel_id="$1"

    if [ -z "$channel_id" ]; then
        print_error "Usage: $0 sync-orders <channel_id>"
        exit 1
    fi

    print_info "Triggering order sync for channel $channel_id..."

    response=$(curl -s -X POST "$BASE_URL/channels/$channel_id/sync" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type":"order-sync"}')

    if echo "$response" | jq -e '.success // .status' > /dev/null 2>&1; then
        print_success "Order sync triggered"
    else
        print_error "Failed to trigger sync"
        echo "$response" | jq '.'
    fi
}

cmd_sync_inventory() {
    require_auth
    local channel_id="$1"

    if [ -z "$channel_id" ]; then
        print_error "Usage: $0 sync-inventory <channel_id>"
        exit 1
    fi

    print_info "Triggering inventory sync for channel $channel_id..."

    response=$(curl -s -X POST "$BASE_URL/channels/$channel_id/sync" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type":"inventory-sync"}')

    if echo "$response" | jq -e '.success // .status' > /dev/null 2>&1; then
        print_success "Inventory sync triggered"
    else
        print_error "Failed to trigger sync"
        echo "$response" | jq '.'
    fi
}

cmd_sync_all() {
    local channel_id="$1"

    if [ -z "$channel_id" ]; then
        print_error "Usage: $0 sync-all <channel_id>"
        exit 1
    fi

    print_header "Syncing All for Channel $channel_id"

    cmd_sync_products "$channel_id"
    sleep 2
    cmd_sync_orders "$channel_id"
    sleep 2
    cmd_sync_inventory "$channel_id"

    print_success "All syncs triggered"
}

cmd_check_health() {
    print_header "Integration Health Check"

    # API health
    response=$(curl -s "$BASE_URL/health")
    echo "API Status:"
    echo "$response" | jq '.'
    echo ""

    # Database check
    if [ -n "$DATABASE_URL" ]; then
        print_info "Checking database..."
        if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
            print_success "Database connection OK"
        else
            print_error "Database connection failed"
        fi
    fi

    # Environment variables
    echo ""
    print_info "Environment Configuration:"
    [ -n "$SHOPIFY_API_KEY" ] && print_success "SHOPIFY_API_KEY set" || print_error "SHOPIFY_API_KEY not set"
    [ -n "$SHOPIFY_API_SECRET" ] && print_success "SHOPIFY_API_SECRET set" || print_error "SHOPIFY_API_SECRET not set"
    [ -n "$SHOPIFY_API_VERSION" ] && print_success "SHOPIFY_API_VERSION set ($SHOPIFY_API_VERSION)" || print_error "SHOPIFY_API_VERSION not set"
}

cmd_show_stats() {
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL not set"
        exit 1
    fi

    print_header "Sync Statistics"

    echo "Products by Channel:"
    psql "$DATABASE_URL" -c "
        SELECT
            c.name,
            COUNT(DISTINCT p.id) as products,
            COUNT(s.id) as skus
        FROM channels c
        LEFT JOIN products p ON c.id = p.channel_id
        LEFT JOIN skus s ON p.id = s.product_id
        WHERE c.type = 'SHOPIFY'
        GROUP BY c.id, c.name;
    "

    echo ""
    echo "Orders by Channel:"
    psql "$DATABASE_URL" -c "
        SELECT
            c.name,
            COUNT(o.id) as total_orders,
            COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM channels c
        LEFT JOIN orders o ON c.id = o.channel_id
        WHERE c.type = 'SHOPIFY'
        GROUP BY c.id, c.name;
    "

    echo ""
    echo "API Performance (Last Hour):"
    psql "$DATABASE_URL" -c "
        SELECT
            COUNT(*) as requests,
            ROUND(AVG(duration_ms), 2) as avg_ms,
            COUNT(*) FILTER (WHERE status_code >= 400) as errors
        FROM integration_logs
        WHERE integration_type = 'SHOPIFY'
        AND created_at > NOW() - INTERVAL '1 hour';
    "
}

##############################################################################
# Main
##############################################################################

main() {
    local command="${1:-help}"
    shift || true

    case "$command" in
        list-channels)
            cmd_list_channels "$@"
            ;;
        create-channel)
            cmd_create_channel "$@"
            ;;
        sync-products)
            cmd_sync_products "$@"
            ;;
        sync-orders)
            cmd_sync_orders "$@"
            ;;
        sync-inventory)
            cmd_sync_inventory "$@"
            ;;
        sync-all)
            cmd_sync_all "$@"
            ;;
        check-health)
            cmd_check_health "$@"
            ;;
        show-stats)
            cmd_show_stats "$@"
            ;;
        login)
            cmd_login "$@"
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Load .env if available
if [ -f ".env" ]; then
    set -a
    source .env 2>/dev/null
    set +a
fi

main "$@"
