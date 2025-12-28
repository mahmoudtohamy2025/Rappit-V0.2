-- ============================================================================
-- Shopify Integration Monitoring Queries
--
-- Comprehensive SQL queries for monitoring Shopify integration health,
-- performance, and data quality
-- ============================================================================

-- Usage: psql $DATABASE_URL -f shopify-monitoring.sql

\echo '========================================'
\echo 'Shopify Integration Monitoring Dashboard'
\echo '========================================'
\echo ''

-- ============================================================================
-- 1. OVERALL HEALTH CHECK
-- ============================================================================

\echo '1. OVERALL HEALTH CHECK'
\echo '----------------------------------------'

-- Active Shopify channels
SELECT
    'Active Shopify Channels' as metric,
    COUNT(*) as count
FROM channels
WHERE type = 'SHOPIFY' AND is_active = true;

-- Last sync timestamps
SELECT
    'Last Sync Status' as metric,
    COUNT(*) FILTER (WHERE last_sync_at > NOW() - INTERVAL '30 minutes') as "synced_last_30min",
    COUNT(*) FILTER (WHERE last_sync_at > NOW() - INTERVAL '1 hour') as "synced_last_hour",
    COUNT(*) FILTER (WHERE last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '1 hour') as "stale"
FROM channels
WHERE type = 'SHOPIFY' AND is_active = true;

\echo ''

-- ============================================================================
-- 2. API PERFORMANCE METRICS
-- ============================================================================

\echo '2. API PERFORMANCE METRICS (Last 24 Hours)'
\echo '----------------------------------------'

-- API call success rate
SELECT
    'API Success Rate' as metric,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful,
    COUNT(*) FILTER (WHERE status_code >= 400) as errors,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) / NULLIF(COUNT(*), 0), 2) as success_rate_pct
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '24 hours';

-- Average response times
SELECT
    'API Response Times' as metric,
    ROUND(AVG(duration_ms), 2) as avg_ms,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms), 2) as median_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms), 2) as p95_ms,
    MAX(duration_ms) as max_ms
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '24 hours'
AND duration_ms IS NOT NULL;

-- Requests by endpoint
SELECT
    endpoint,
    COUNT(*) as request_count,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    COUNT(*) FILTER (WHERE status_code >= 400) as errors
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY request_count DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 3. ERROR ANALYSIS
-- ============================================================================

\echo '3. ERROR ANALYSIS (Last 24 Hours)'
\echo '----------------------------------------'

-- Errors by status code
SELECT
    status_code,
    COUNT(*) as error_count,
    string_agg(DISTINCT substring(error_message, 1, 50), ', ') as sample_errors
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code >= 400
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status_code
ORDER BY error_count DESC;

-- Rate limit violations (429 errors)
SELECT
    'Rate Limit Errors' as metric,
    COUNT(*) as count_429,
    MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code = 429
AND created_at > NOW() - INTERVAL '24 hours';

-- Authentication errors
SELECT
    'Authentication Errors' as metric,
    COUNT(*) as count_401_403,
    MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code IN (401, 403)
AND created_at > NOW() - INTERVAL '24 hours';

\echo ''

-- ============================================================================
-- 4. SYNC STATISTICS
-- ============================================================================

\echo '4. SYNC STATISTICS'
\echo '----------------------------------------'

-- Products synced
SELECT
    c.name as channel_name,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(s.id) as sku_count,
    MAX(p.created_at) as last_product_synced
FROM channels c
LEFT JOIN products p ON c.id = p.channel_id
LEFT JOIN skus s ON p.id = s.product_id
WHERE c.type = 'SHOPIFY'
GROUP BY c.id, c.name
ORDER BY product_count DESC;

-- Orders synced
SELECT
    c.name as channel_name,
    COUNT(o.id) as total_orders,
    COUNT(o.id) FILTER (WHERE o.created_at > NOW() - INTERVAL '24 hours') as orders_last_24h,
    COUNT(o.id) FILTER (WHERE o.status = 'NEW') as new_orders,
    COUNT(o.id) FILTER (WHERE o.status = 'RESERVED') as reserved_orders,
    MAX(o.created_at) as last_order_synced
FROM channels c
LEFT JOIN orders o ON c.id = o.channel_id
WHERE c.type = 'SHOPIFY'
GROUP BY c.id, c.name
ORDER BY total_orders DESC;

\echo ''

-- ============================================================================
-- 5. INVENTORY & RESERVATIONS
-- ============================================================================

\echo '5. INVENTORY & RESERVATIONS'
\echo '----------------------------------------'

-- Active inventory reservations
SELECT
    'Active Reservations' as metric,
    COUNT(*) as reservation_count,
    SUM(ir.quantity) as total_units_reserved
FROM inventory_reservations ir
INNER JOIN orders o ON ir.reference_id::text = o.id::text
WHERE o.channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND ir.released_at IS NULL;

-- Reservations by order status
SELECT
    o.status,
    COUNT(DISTINCT ir.id) as reservation_count,
    SUM(ir.quantity) as units_reserved
FROM inventory_reservations ir
INNER JOIN orders o ON ir.reference_id::text = o.id::text
WHERE o.channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND ir.released_at IS NULL
GROUP BY o.status
ORDER BY reservation_count DESC;

\echo ''

-- ============================================================================
-- 6. WEBHOOK PROCESSING
-- ============================================================================

\echo '6. WEBHOOK PROCESSING (Last 24 Hours)'
\echo '----------------------------------------'

-- Webhooks by status
SELECT
    status,
    COUNT(*) as webhook_count,
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(processed_at, NOW()) - created_at))), 2) as avg_processing_time_sec
FROM processed_webhook_events
WHERE source = 'shopify'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY webhook_count DESC;

-- Webhooks by event type
SELECT
    event_type,
    COUNT(*) as event_count,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
    COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM processed_webhook_events
WHERE source = 'shopify'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY event_count DESC;

-- Recent failed webhooks
SELECT
    event_type,
    external_event_id,
    error_message,
    created_at
FROM processed_webhook_events
WHERE source = 'shopify'
AND status = 'FAILED'
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

\echo ''

-- ============================================================================
-- 7. DATA QUALITY CHECKS
-- ============================================================================

\echo '7. DATA QUALITY CHECKS'
\echo '----------------------------------------'

-- Orders without reservations (should be rare)
SELECT
    'Orders Without Reservations' as check_name,
    COUNT(*) as issue_count
FROM orders o
LEFT JOIN inventory_reservations ir ON ir.reference_id::text = o.id::text AND ir.released_at IS NULL
WHERE o.channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND o.status IN ('RESERVED', 'CONFIRMED', 'SHIPPED')
AND ir.id IS NULL;

-- Products without SKUs
SELECT
    'Products Without SKUs' as check_name,
    COUNT(*) as issue_count
FROM products p
LEFT JOIN skus s ON p.id = s.product_id
WHERE p.channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND s.id IS NULL;

-- Duplicate SKUs
SELECT
    'Duplicate SKUs' as check_name,
    COUNT(*) as issue_count
FROM (
    SELECT sku
    FROM skus
    GROUP BY sku
    HAVING COUNT(*) > 1
) dup;

-- Orders with unmapped SKUs
SELECT
    'Orders with Unmapped SKUs' as check_name,
    COUNT(DISTINCT o.id) as order_count
FROM orders o
INNER JOIN order_items oi ON o.id = oi.order_id
WHERE o.channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND oi.sku LIKE 'SHOPIFY-%'
AND o.created_at > NOW() - INTERVAL '7 days';

\echo ''

-- ============================================================================
-- 8. PERFORMANCE TRENDS
-- ============================================================================

\echo '8. PERFORMANCE TRENDS (Hourly, Last 24 Hours)'
\echo '----------------------------------------'

SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as api_calls,
    ROUND(AVG(duration_ms), 2) as avg_duration_ms,
    COUNT(*) FILTER (WHERE status_code >= 400) as errors
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC
LIMIT 24;

\echo ''

-- ============================================================================
-- 9. RECENT ACTIVITY
-- ============================================================================

\echo '9. RECENT ACTIVITY (Last 10 Sync Operations)'
\echo '----------------------------------------'

SELECT
    c.name as channel,
    CASE
        WHEN il.endpoint LIKE '%products%' THEN 'Product Sync'
        WHEN il.endpoint LIKE '%orders%' THEN 'Order Sync'
        WHEN il.endpoint LIKE '%inventory%' THEN 'Inventory Sync'
        ELSE 'Other'
    END as sync_type,
    il.status_code,
    il.duration_ms,
    il.created_at
FROM integration_logs il
LEFT JOIN channels c ON il.channel_id = c.id
WHERE il.integration_type = 'SHOPIFY'
ORDER BY il.created_at DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 10. ALERTS & RECOMMENDATIONS
-- ============================================================================

\echo '10. ALERTS & RECOMMENDATIONS'
\echo '----------------------------------------'

-- Check for stale channels (not synced in over 1 hour)
SELECT
    'ALERT: Stale Channels' as alert_type,
    name as channel_name,
    last_sync_at,
    NOW() - last_sync_at as time_since_sync
FROM channels
WHERE type = 'SHOPIFY'
AND is_active = true
AND (last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '1 hour');

-- Check for high error rate (>10% in last hour)
WITH error_rate AS (
    SELECT
        COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / NULLIF(COUNT(*), 0) as error_pct
    FROM integration_logs
    WHERE integration_type = 'SHOPIFY'
    AND created_at > NOW() - INTERVAL '1 hour'
)
SELECT
    'ALERT: High Error Rate' as alert_type,
    ROUND(error_pct, 2) as error_percentage
FROM error_rate
WHERE error_pct > 10;

-- Check for authentication issues
SELECT
    'ALERT: Authentication Errors' as alert_type,
    COUNT(*) as auth_error_count,
    MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code IN (401, 403)
AND created_at > NOW() - INTERVAL '15 minutes'
HAVING COUNT(*) > 0;

\echo ''
\echo '========================================'
\echo 'Monitoring Complete'
\echo '========================================'
