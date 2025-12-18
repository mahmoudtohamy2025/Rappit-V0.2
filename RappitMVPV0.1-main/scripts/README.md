# Shopify Integration Scripts

This directory contains comprehensive tools for deploying, testing, and monitoring the Shopify integration.

## Available Scripts

### 1. shopify-test-suite.sh
Automated test suite for validating Shopify integration deployment.

**Usage:**
```bash
# Run all tests
./scripts/shopify-test-suite.sh

# With custom API URL
API_URL=https://your-domain.com ./scripts/shopify-test-suite.sh
```

**Tests include:**
- Health check
- Database connectivity
- Shopify configuration validation
- API authentication
- Product sync verification
- Order sync verification
- Webhook endpoints
- Integration logging
- Performance benchmarks

### 2. shopify-monitoring.sql
Comprehensive SQL queries for monitoring integration health and performance.

**Usage:**
```bash
# Run all monitoring queries
psql $DATABASE_URL -f scripts/shopify-monitoring.sql

# Save output to file
psql $DATABASE_URL -f scripts/shopify-monitoring.sql > monitoring-report.txt

# Run specific section
psql $DATABASE_URL -c "$(sed -n '/API PERFORMANCE/,/^$/p' scripts/shopify-monitoring.sql)"
```

**Sections:**
1. Overall health check
2. API performance metrics
3. Error analysis
4. Sync statistics
5. Inventory & reservations
6. Webhook processing
7. Data quality checks
8. Performance trends
9. Recent activity
10. Alerts & recommendations

### 3. shopify-admin.sh
Command-line admin tool for managing Shopify channels and syncs.

**Usage:**
```bash
# Show help
./scripts/shopify-admin.sh help

# Login and save token
export JWT_TOKEN=$(./scripts/shopify-admin.sh login admin@example.com password123)

# List all Shopify channels
./scripts/shopify-admin.sh list-channels

# Create new channel (interactive)
./scripts/shopify-admin.sh create-channel

# Trigger syncs
./scripts/shopify-admin.sh sync-products CHANNEL_ID
./scripts/shopify-admin.sh sync-orders CHANNEL_ID
./scripts/shopify-admin.sh sync-inventory CHANNEL_ID
./scripts/shopify-admin.sh sync-all CHANNEL_ID

# Check health
./scripts/shopify-admin.sh check-health

# Show statistics
./scripts/shopify-admin.sh show-stats
```

## Quick Start Guide

### Initial Deployment

1. **Validate environment:**
```bash
# Check all required environment variables
./scripts/shopify-admin.sh check-health
```

2. **Run test suite:**
```bash
# Basic validation
./scripts/shopify-test-suite.sh
```

3. **Create your first channel:**
```bash
# Interactive channel creation
./scripts/shopify-admin.sh create-channel
```

4. **Trigger initial sync:**
```bash
# Replace CHANNEL_ID with your channel ID
./scripts/shopify-admin.sh sync-all CHANNEL_ID
```

5. **Monitor results:**
```bash
# View monitoring dashboard
psql $DATABASE_URL -f scripts/shopify-monitoring.sql
```

### Daily Operations

**Morning Health Check:**
```bash
#!/bin/bash
# morning-check.sh

echo "=== Daily Shopify Integration Health Check ==="

# 1. Check API health
./scripts/shopify-admin.sh check-health

# 2. Show sync stats
./scripts/shopify-admin.sh show-stats

# 3. Check for errors
psql $DATABASE_URL -c "
SELECT COUNT(*) as error_count
FROM integration_logs
WHERE integration_type='SHOPIFY'
AND status_code >= 400
AND created_at > NOW() - INTERVAL '24 hours';"

echo "=== Health Check Complete ==="
```

**On-Demand Sync:**
```bash
# Sync specific channel immediately
CHANNEL_ID="your-channel-id"
./scripts/shopify-admin.sh sync-products $CHANNEL_ID
./scripts/shopify-admin.sh sync-orders $CHANNEL_ID
```

**Troubleshooting:**
```bash
# Check for errors in last hour
psql $DATABASE_URL -c "
SELECT endpoint, status_code, error_message, created_at
FROM integration_logs
WHERE integration_type='SHOPIFY'
AND status_code >= 400
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC LIMIT 10;"

# Check stale channels (not synced recently)
psql $DATABASE_URL -c "
SELECT id, name, last_sync_at
FROM channels
WHERE type='SHOPIFY'
AND is_active=true
AND (last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '2 hours');"
```

## Monitoring Best Practices

### Set Up Cron Jobs

Add to crontab for automated monitoring:

```cron
# Run monitoring report every hour
0 * * * * cd /path/to/rappit && psql $DATABASE_URL -f scripts/shopify-monitoring.sql > /var/log/shopify-monitor-$(date +\%Y\%m\%d-\%H00).log 2>&1

# Run test suite daily at 6 AM
0 6 * * * cd /path/to/rappit && ./scripts/shopify-test-suite.sh > /var/log/shopify-tests-$(date +\%Y\%m\%d).log 2>&1

# Check for errors every 15 minutes
*/15 * * * * cd /path/to/rappit && psql $DATABASE_URL -c "SELECT COUNT(*) FROM integration_logs WHERE integration_type='SHOPIFY' AND status_code >= 400 AND created_at > NOW() - INTERVAL '15 minutes'" | grep -v "0$" && echo "Shopify errors detected!" | mail -s "Shopify Alert" admin@example.com
```

### Alerting

Create alerts for critical issues:

```bash
#!/bin/bash
# alert-check.sh

# Check for high error rate
ERROR_RATE=$(psql $DATABASE_URL -t -c "
SELECT COUNT(*) * 100.0 / NULLIF(COUNT(*), 0)
FROM integration_logs
WHERE integration_type='SHOPIFY'
AND created_at > NOW() - INTERVAL '1 hour'
AND status_code >= 400" | tr -d ' ')

if (( $(echo "$ERROR_RATE > 10" | bc -l) )); then
    echo "ALERT: Shopify error rate is ${ERROR_RATE}%" | mail -s "Shopify High Error Rate" admin@example.com
fi

# Check for authentication errors
AUTH_ERRORS=$(psql $DATABASE_URL -t -c "
SELECT COUNT(*)
FROM integration_logs
WHERE integration_type='SHOPIFY'
AND status_code IN (401, 403)
AND created_at > NOW() - INTERVAL '15 minutes'" | tr -d ' ')

if [ "$AUTH_ERRORS" -gt 0 ]; then
    echo "ALERT: $AUTH_ERRORS authentication errors detected" | mail -s "Shopify Auth Error" admin@example.com
fi
```

## Environment Variables

All scripts respect these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Base API URL | `http://localhost:3000` |
| `API_PREFIX` | API prefix | `api/v1` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_TOKEN` | Authentication token | - |
| `SHOPIFY_API_KEY` | Shopify API key | - |
| `SHOPIFY_API_SECRET` | Shopify API secret | - |
| `SHOPIFY_API_VERSION` | Shopify API version | `2024-01` |

## Troubleshooting

### Script Errors

**Permission Denied:**
```bash
chmod +x scripts/*.sh
```

**Command Not Found (jq, psql):**
```bash
# Ubuntu/Debian
sudo apt-get install jq postgresql-client

# macOS
brew install jq postgresql
```

**Database Connection Failed:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check if DATABASE_URL is set
echo $DATABASE_URL
```

### Common Issues

**No channels found:**
- Verify JWT_TOKEN is set: `echo $JWT_TOKEN`
- Check authentication: `./scripts/shopify-admin.sh check-health`
- Create a channel: `./scripts/shopify-admin.sh create-channel`

**Sync not triggering:**
- Check if worker is running: `pm2 list`
- View worker logs: `pm2 logs rappit-api`
- Verify channel is active: `./scripts/shopify-admin.sh list-channels`

**High error rate:**
- Check integration logs: `psql $DATABASE_URL -f scripts/shopify-monitoring.sql`
- Verify API credentials are correct
- Check Shopify API status: https://status.shopify.com/

## Support

For issues or questions:
1. Check the deployment guide: `SHOPIFY_DEPLOYMENT_GUIDE.md`
2. Review integration summary: `SHOPIFY_INTEGRATION_SUMMARY.md`
3. Create a GitHub issue with script output and error messages

## Contributing

When adding new scripts:
1. Add execute permissions: `chmod +x script.sh`
2. Document in this README
3. Follow existing naming conventions
4. Include help text and error handling
