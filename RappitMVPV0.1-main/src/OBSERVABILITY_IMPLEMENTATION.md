# ✅ Observability Implementation - Complete

## Overview

Full observability has been implemented across the Shipping module following production-grade best practices.

---

## 🔍 **Components Implemented**

### **1. Correlation ID Middleware** ✅
**File:** `/src/middleware/correlation-id.middleware.ts`

- Generates UUID v4 correlation ID for each request
- Accepts `X-Correlation-ID` header from clients
- Attaches to request object as `req.correlationId`
- Echoes back in response header `X-Correlation-ID`

**Usage:**
```typescript
// In main.ts or app.module.ts
app.use(new CorrelationIdMiddleware().use);
```

---

### **2. Request Logging Interceptor** ✅
**File:** `/src/interceptors/request-logging.interceptor.ts`

Logs all HTTP requests with:
- `method`, `path`, `statusCode`
- `orgId`, `userId` (from auth guard)
- `correlationId`
- `duration` in milliseconds
- `success` boolean
- `error` details (if any)

**Output Example:**
```json
{
  "timestamp": "2024-12-15T10:30:45.123Z",
  "level": "info",
  "type": "request_complete",
  "method": "POST",
  "path": "/orders/ORDER123/shipment",
  "statusCode": 200,
  "duration": 234,
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "orgId": "ORG-001",
  "userId": "USER-001",
  "success": true
}
```

**Usage:**
```typescript
// In app.module.ts
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
```

---

### **3. Integration Logging Service** ✅
**File:** `/src/services/integration-logging.service.ts`

Creates `IntegrationLog` records for every external API call.

**Features:**
- Automatic request/response logging
- Sensitive data masking (passwords, API keys, tokens)
- Error capture with truncated messages (max 2000 chars)
- Duration tracking
- Correlation ID propagation

**Fields Logged:**
```typescript
{
  organizationId: string;
  channelId?: string;
  integrationType: 'DHL' | 'FEDEX' | 'SHOPIFY' | 'WOOCOMMERCE';
  direction: 'OUTBOUND' | 'INBOUND';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  statusCode?: number;
  request: any; // masked
  response: any; // masked
  errorMessage?: string; // truncated
  durationMs: number;
}
```

**Methods:**
- `logSuccess()` - Log successful integration call
- `logFailure()` - Log failed integration call
- `logInboundWebhook()` - Log inbound webhooks (DHL/FedEx tracking)

**Sensitive Data Masking:**
Automatically masks these fields:
- password, apiKey, api_key, secret, token
- accessToken, refreshToken, authorization
- cardNumber, cvv, ssn, credentials

---

### **4. Structured Logger** ✅
**File:** `/src/utils/structured-logger.ts`

Wrapper around NestJS Logger with structured logging format.

**Features:**
- All logs are JSON objects
- Automatic metadata inclusion
- Correlation ID support
- Context-aware logging

**Usage:**
```typescript
import { createLogger } from '@utils/structured-logger';

const logger = createLogger('DHLIntegration');

logger.log('Creating shipment', {
  correlationId: 'abc-123',
  orderId: 'ORDER-001',
  orgId: 'ORG-001',
});

logger.error('Shipment creation failed', error, {
  correlationId: 'abc-123',
  orderId: 'ORDER-001',
});

logger.logIntegration('createShipment', 'DHL', true, 234, {
  correlationId: 'abc-123',
});

logger.logJob('shipment-create', 'completed', {
  jobId: 'job-123',
  correlationId: 'abc-123',
});
```

**Output:**
```json
{
  "timestamp": "2024-12-15T10:30:45.123Z",
  "level": "info",
  "message": "Creating shipment",
  "correlationId": "abc-123",
  "orderId": "ORDER-001",
  "orgId": "ORG-001"
}
```

---

### **5. Integration Services with Observability** ✅

**DHL Integration Service:** `/src/integrations/shipping/dhl-integration.service.ts`
**FedEx Integration Service:** `/src/integrations/shipping/fedex-integration.service.ts`

Both services now include:
- Correlation ID propagation through all methods
- Automatic `IntegrationLog` creation
- Structured logging with context
- Duration tracking
- Error logging with full context

**Example:**
```typescript
async createShipment(
  shippingAccount: any,
  request: DHLShipmentRequest,
  correlationId?: string, // <-- Correlation ID parameter
): Promise<DHLShipmentResponse> {
  const startTime = Date.now();

  try {
    // ... create shipment ...

    const duration = Date.now() - startTime;

    // Log success to database + application logs
    await this.logSuccess(
      orgId,
      'createShipment',
      endpoint,
      'POST',
      request,
      response,
      duration,
      correlationId,
    );

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failure
    await this.logFailure(
      orgId,
      'createShipment',
      endpoint,
      'POST',
      request,
      error,
      500,
      duration,
      correlationId,
    );

    throw error;
  }
}
```

---

### **6. Workers with Observability** ✅

**Shipment Create Worker:** `/src/workers/shipment-create.worker.ts`
**Shipment Track Worker:** `/src/workers/shipment-track.worker.ts`

Both workers include:
- Correlation ID extraction from job payload
- Structured logging with correlation ID
- Job lifecycle logging (started, completed, failed)
- Error logging with full context

**Job Payload:**
```typescript
{
  jobId: "shipment:create:org:ORG123:order:ORDER456:carrier:DHL",
  shipmentId: "SHIP-001",
  orderId: "ORDER-001",
  orgId: "ORG-001",
  carrierType: "DHL",
  options: { ... },
  correlationId: "550e8400-e29b-41d4-a716-446655440000" // <-- Propagated!
}
```

**Worker Logs:**
```json
{
  "timestamp": "2024-12-15T10:30:45.123Z",
  "level": "info",
  "message": "Job shipment-create started",
  "jobId": "shipment:create:org:ORG123:order:ORDER456:carrier:DHL",
  "shipmentId": "SHIP-001",
  "orderId": "ORDER-001",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 🚀 **End-to-End Tracing Example**

### **Request Flow:**

1. **HTTP Request Arrives**
   ```
   POST /orders/ORDER-123/shipment
   X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
   ```

2. **Correlation ID Middleware**
   - Extracts `550e8400...` from header
   - Attaches to `req.correlationId`

3. **Request Logging Interceptor**
   ```json
   {
     "type": "request_start",
     "correlationId": "550e8400...",
     "method": "POST",
     "path": "/orders/ORDER-123/shipment"
   }
   ```

4. **ShippingService.createShipmentForOrder()**
   - Creates shipment record
   - Enqueues job with `correlationId: "550e8400..."`

5. **Worker Receives Job**
   ```json
   {
     "type": "job",
     "message": "Job shipment-create started",
     "correlationId": "550e8400...",
     "jobId": "shipment:create:..."
   }
   ```

6. **Worker Calls DHL Integration**
   - Passes `correlationId: "550e8400..."`
   - DHL service logs:
     ```json
     {
       "type": "integration",
       "operation": "createShipment",
       "provider": "DHL",
       "correlationId": "550e8400...",
       "success": true,
       "durationMs": 234
     }
     ```

7. **IntegrationLog Record Created**
   ```sql
   INSERT INTO integration_logs (
     organization_id,
     integration_type,
     direction,
     endpoint,
     method,
     status_code,
     request,
     response,
     duration_ms,
     created_at
   ) VALUES (
     'ORG-001',
     'DHL',
     'OUTBOUND',
     'https://api.dhl.com/shipments',
     'POST',
     200,
     '{"operation":"createShipment",...}', -- masked
     '{"carrierShipmentId":"DHL-123",...}',
     234,
     NOW()
   );
   ```

8. **Worker Completes**
   ```json
   {
     "type": "job",
     "message": "Job shipment-create completed",
     "correlationId": "550e8400...",
     "trackingNumber": "DHL123456"
   }
   ```

9. **Request Complete**
   ```json
   {
     "type": "request_complete",
     "correlationId": "550e8400...",
     "statusCode": 200,
     "duration": 456,
     "success": true
   }
   ```

**Result:** Full traceability from HTTP request → job → integration call → response!

---

## 📊 **Database Queries for Observability**

### **1. View All Logs for Correlation ID**
```sql
-- Application logs (if using JSON logging to DB)
SELECT * FROM application_logs
WHERE correlation_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at;

-- Integration logs
SELECT
  integration_type,
  endpoint,
  method,
  status_code,
  duration_ms,
  created_at
FROM integration_logs
WHERE request->>'correlationId' = '550e8400-e29b-41d4-a716-446655440000'
   OR response->>'correlationId' = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at;
```

### **2. Integration Success Rate**
```sql
SELECT
  integration_type,
  COUNT(*) as total_calls,
  SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as successful_calls,
  ROUND(
    100.0 * SUM(CASE WHEN status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as success_rate,
  ROUND(AVG(duration_ms), 2) as avg_duration_ms
FROM integration_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY integration_type;
```

### **3. Slowest Integration Calls**
```sql
SELECT
  integration_type,
  endpoint,
  method,
  duration_ms,
  status_code,
  created_at
FROM integration_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY duration_ms DESC
LIMIT 20;
```

### **4. Failed Integration Calls**
```sql
SELECT
  integration_type,
  endpoint,
  method,
  status_code,
  error_message,
  created_at
FROM integration_logs
WHERE status_code >= 400
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

---

## 🔧 **Configuration**

### **Environment Variables**
```env
# Logging
LOG_LEVEL=info  # debug, info, warn, error
NODE_ENV=development  # production hides stack traces

# Observability
ENABLE_INTEGRATION_LOGGING=true
ENABLE_REQUEST_LOGGING=true
```

### **App Setup**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { RequestLoggingInterceptor } from './interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Correlation ID middleware (global)
  app.use((req, res, next) => {
    new CorrelationIdMiddleware().use(req, res, next);
  });

  // Request logging interceptor (global)
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  await app.listen(3000);
}
bootstrap();
```

---

## 📈 **Metrics & Monitoring**

### **Key Metrics to Track**

1. **Request Metrics**
   - Request rate (req/s)
   - Response time (p50, p95, p99)
   - Error rate (%)

2. **Integration Metrics**
   - DHL API success rate
   - DHL API latency
   - FedEx API success rate
   - FedEx API latency

3. **Job Metrics**
   - Job processing time
   - Job failure rate
   - Queue depth

4. **Business Metrics**
   - Shipments created/hour
   - Label generation success rate
   - Tracking update frequency

### **Log Aggregation**

Use DataDog, New Relic, or ELK Stack to aggregate JSON logs.

**Example DataDog Query:**
```
service:rappit-shipping
  AND correlationId:550e8400-*
  ORDER BY timestamp
```

---

## ✅ **Acceptance Criteria Met**

✅ Centralized logger with structured JSON output
✅ Request logging (path, method, orgId, userId, status, duration, correlationId)
✅ Integration call logging (provider, operation, request metadata, response metadata, success/failure)
✅ Correlation IDs generated on incoming HTTP requests
✅ Correlation IDs propagated into job payloads
✅ Correlation IDs used in workers
✅ IntegrationLog entity usage for every external call
✅ Sensitive data masking
✅ Error truncation (max 2000 chars)
✅ Duration tracking
✅ Logging middleware/interceptors created
✅ Integration logging hooks in integration services

---

## 🎯 **Next Steps**

1. **Production Integration:**
   - Configure DataDog/New Relic APM
   - Set up log aggregation
   - Create dashboards for key metrics
   - Configure alerts for failures

2. **Performance:**
   - Async logging (don't block requests)
   - Log sampling for high-traffic endpoints
   - Batch IntegrationLog inserts

3. **Compliance:**
   - PII detection and redaction
   - Audit log retention policies
   - GDPR compliance for log data

---

## 🎉 **STATUS: COMPLETE!**

Full observability is now implemented across the Shipping module with:
- ✅ Correlation ID tracing
- ✅ Structured logging
- ✅ Integration logging
- ✅ Request/response tracking
- ✅ Error capture
- ✅ Performance monitoring

**Ready for production deployment with full observability!** 🚀
