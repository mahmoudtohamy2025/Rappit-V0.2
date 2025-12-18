# ✅ Phase 4: OrdersController (REST API & RBAC) - COMPLETE

## Overview

The **OrdersController** has been fully implemented with complete REST API endpoints, RBAC enforcement, organization scoping, and comprehensive integration tests. All endpoints are protected by JWT authentication and role-based access control.

## API Endpoints

### Base URL: `/orders`

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

---

## 📋 Endpoint Reference

### 1. **GET /orders** - List Orders

**Description:** List all orders with filters and pagination

**Access:** `OPERATOR`, `MANAGER`, `ADMIN`

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `status` | OrderStatus | No | Filter by order status | `RESERVED` |
| `channelId` | UUID | No | Filter by sales channel | `channel-123` |
| `search` | string | No | Search by order number, customer name/email | `ORD-202412` |
| `startDate` | ISO 8601 | No | Filter orders from this date | `2024-12-01` |
| `endDate` | ISO 8601 | No | Filter orders until this date | `2024-12-31` |
| `page` | number | No | Page number (default: 1) | `1` |
| `limit` | number | No | Items per page (default: 20) | `20` |

**Response:**
```json
{
  "data": [
    {
      "id": "order-123",
      "orderNumber": "ORD-202412-00001",
      "status": "RESERVED",
      "channelId": "channel-123",
      "customer": {
        "firstName": "Ahmed",
        "lastName": "Al-Saud",
        "email": "ahmed@example.com"
      },
      "items": [...],
      "totalAmount": 5750,
      "currency": "SAR",
      "importedAt": "2024-12-11T10:00:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**cURL Example:**
```bash
curl -X GET "https://api.rappit.io/orders?status=RESERVED&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 2. **GET /orders/:id** - Get Order Details

**Description:** Retrieve a single order with complete details

**Access:** `OPERATOR`, `MANAGER`, `ADMIN`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Order ID |

**Response:**
```json
{
  "id": "order-123",
  "organizationId": "org-123",
  "channelId": "channel-123",
  "orderNumber": "ORD-202412-00001",
  "externalOrderId": "shopify-order-456",
  "status": "RESERVED",
  "paymentStatus": "PAID",
  "customer": {
    "id": "customer-123",
    "firstName": "Ahmed",
    "lastName": "Al-Saud",
    "email": "ahmed@example.com",
    "phone": "+966501234567"
  },
  "shippingAddress": {
    "street1": "King Fahd Road",
    "city": "Riyadh",
    "postalCode": "12345",
    "country": "SA"
  },
  "items": [
    {
      "id": "item-123",
      "sku": {
        "sku": "LAPTOP-HP-15",
        "name": "HP Laptop 15-inch"
      },
      "quantity": 2,
      "unitPrice": 2500,
      "totalPrice": 5000
    }
  ],
  "reservations": [
    {
      "id": "reservation-123",
      "quantityReserved": 2,
      "reservedAt": "2024-12-11T10:00:00Z",
      "releasedAt": null
    }
  ],
  "shipments": [],
  "timelineEvents": [
    {
      "id": "event-123",
      "eventType": "order_created",
      "actorType": "CHANNEL",
      "description": "Order imported from Shopify Store",
      "createdAt": "2024-12-11T10:00:00Z"
    },
    {
      "id": "event-124",
      "eventType": "status_changed",
      "actorType": "SYSTEM",
      "fromStatus": "NEW",
      "toStatus": "RESERVED",
      "description": "Inventory reserved",
      "createdAt": "2024-12-11T10:00:05Z"
    }
  ],
  "subtotal": 5000,
  "shippingCost": 0,
  "taxAmount": 750,
  "totalAmount": 5750,
  "currency": "SAR",
  "importedAt": "2024-12-11T10:00:00Z",
  "reservedAt": "2024-12-11T10:00:05Z",
  "createdAt": "2024-12-11T10:00:00Z",
  "updatedAt": "2024-12-11T10:00:05Z"
}
```

**cURL Example:**
```bash
curl -X GET "https://api.rappit.io/orders/order-123" \
  -H "Authorization: Bearer <token>"
```

---

### 3. **POST /orders** - Create/Update Order from Channel

**Description:** Import or update an order from a sales channel (Shopify, WooCommerce). Idempotent.

**Access:** `MANAGER`, `ADMIN`

**Request Body:**
```json
{
  "channelId": "channel-123",
  "externalOrderId": "shopify-order-456",
  "orderNumber": "1001",
  "customer": {
    "externalId": "shopify-customer-789",
    "firstName": "Ahmed",
    "lastName": "Al-Saud",
    "email": "ahmed@example.com",
    "phone": "+966501234567"
  },
  "shippingAddress": {
    "firstName": "Ahmed",
    "lastName": "Al-Saud",
    "company": "Tech Company",
    "street1": "King Fahd Road",
    "street2": "Building 12, Floor 3",
    "city": "Riyadh",
    "state": "Riyadh",
    "postalCode": "12345",
    "country": "SA",
    "phone": "+966501234567"
  },
  "billingAddress": {
    // Same structure as shippingAddress (optional)
  },
  "items": [
    {
      "externalItemId": "shopify-item-1",
      "sku": "LAPTOP-HP-15",
      "name": "HP Laptop 15-inch",
      "variantName": "16GB RAM",
      "quantity": 2,
      "unitPrice": 2500,
      "totalPrice": 5000,
      "taxAmount": 750,
      "discountAmount": 0
    }
  ],
  "subtotal": 5000,
  "shippingCost": 0,
  "taxAmount": 750,
  "discountAmount": 0,
  "totalAmount": 5750,
  "currency": "SAR",
  "paymentStatus": "PAID",
  "customerNote": "Please call before delivery",
  "tags": ["priority", "vip"],
  "metadata": {
    "shopify_order_id": "12345",
    "source": "shopify"
  },
  "orderDate": "2024-12-11T10:00:00Z"
}
```

**Response:** (Same as GET /orders/:id)

**Features:**
- ✅ **Idempotent** - Safe to call multiple times with same `externalOrderId`
- ✅ **Auto-reserves inventory** - Automatically reserves stock if order is NEW
- ✅ **Customer reconciliation** - Creates or updates customer
- ✅ **Address creation** - Creates shipping/billing addresses
- ✅ **Order item upsert** - Updates items based on `externalItemId`

**cURL Example:**
```bash
curl -X POST "https://api.rappit.io/orders" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "channel-123",
    "externalOrderId": "shopify-order-456",
    "customer": {...},
    "shippingAddress": {...},
    "items": [...],
    "subtotal": 5000,
    "totalAmount": 5750
  }'
```

---

### 4. **PATCH /orders/:id/status** - Update Order Status

**Description:** Update order status with state machine validation

**Access:** `MANAGER`, `ADMIN`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Order ID |

**Request Body:**
```json
{
  "status": "READY_TO_SHIP",
  "comment": "Payment confirmed by Stripe webhook"
}
```

**Valid Status Values:**
```
NEW, RESERVED, READY_TO_SHIP, LABEL_CREATED, PICKED_UP,
IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, FAILED, RETURNED
```

**Response:**
```json
{
  "id": "order-123",
  "status": "READY_TO_SHIP",
  "readyToShipAt": "2024-12-11T12:00:00Z",
  ...
}
```

**State Machine Validation:**
- ✅ Only valid transitions allowed (see state diagram in ORDERS_SERVICE_COMPLETE.md)
- ✅ Invalid transitions return `400 Bad Request`
- ✅ Automatically reserves/releases inventory
- ✅ Creates timeline event

**Error Responses:**

**400 Bad Request** - Invalid transition:
```json
{
  "statusCode": 400,
  "message": "Invalid state transition from DELIVERED to NEW",
  "error": "Bad Request"
}
```

**404 Not Found** - Order not found:
```json
{
  "statusCode": 404,
  "message": "Order not found",
  "error": "Not Found"
}
```

**cURL Example:**
```bash
curl -X PATCH "https://api.rappit.io/orders/order-123/status" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "READY_TO_SHIP",
    "comment": "Payment confirmed"
  }'
```

---

### 5. **POST /orders/:id/notes** - Add Internal Note

**Description:** Add an internal note for team communication

**Access:** `OPERATOR`, `MANAGER`, `ADMIN`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Order ID |

**Request Body:**
```json
{
  "note": "Customer confirmed delivery address via phone call"
}
```

**Response:**
```json
{
  "id": "event-125",
  "orderId": "order-123",
  "eventType": "note_added",
  "actorType": "USER",
  "actorId": "user-456",
  "description": "Customer confirmed delivery address via phone call",
  "createdAt": "2024-12-11T13:00:00Z"
}
```

**cURL Example:**
```bash
curl -X POST "https://api.rappit.io/orders/order-123/notes" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Customer confirmed delivery address"
  }'
```

---

### 6. **GET /orders/:id/timeline** - Get Order Timeline

**Description:** Retrieve chronological audit trail of all order events

**Access:** `OPERATOR`, `MANAGER`, `ADMIN`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Order ID |

**Response:**
```json
{
  "orderId": "order-123",
  "orderNumber": "ORD-202412-00001",
  "timeline": [
    {
      "id": "event-123",
      "eventType": "order_created",
      "actorType": "CHANNEL",
      "actorId": "channel-123",
      "description": "Order imported from Shopify Store",
      "metadata": {
        "externalOrderId": "shopify-order-456",
        "channelName": "Shopify Store"
      },
      "createdAt": "2024-12-11T10:00:00Z"
    },
    {
      "id": "event-124",
      "eventType": "status_changed",
      "actorType": "SYSTEM",
      "fromStatus": "NEW",
      "toStatus": "RESERVED",
      "description": "Status changed from NEW to RESERVED",
      "createdAt": "2024-12-11T10:00:05Z"
    },
    {
      "id": "event-125",
      "eventType": "inventory_reserved",
      "actorType": "SYSTEM",
      "description": "Inventory reserved",
      "metadata": {
        "itemCount": 2
      },
      "createdAt": "2024-12-11T10:00:06Z"
    },
    {
      "id": "event-126",
      "eventType": "note_added",
      "actorType": "USER",
      "actorId": "user-operator-789",
      "description": "Customer confirmed delivery address",
      "createdAt": "2024-12-11T12:30:00Z"
    },
    {
      "id": "event-127",
      "eventType": "status_changed",
      "actorType": "USER",
      "actorId": "user-manager-456",
      "fromStatus": "RESERVED",
      "toStatus": "READY_TO_SHIP",
      "description": "Payment confirmed",
      "createdAt": "2024-12-11T13:00:00Z"
    }
  ]
}
```

**Event Types:**
- `order_created` - Order imported from channel
- `order_updated` - Order updated from channel
- `status_changed` - Status transition
- `note_added` - Internal note added
- `inventory_reserved` - Inventory reserved
- `inventory_released` - Inventory released
- `payment_received` - Payment confirmed
- `label_created` - Shipping label generated
- `shipment_dispatched` - Package picked up
- Custom event types

**cURL Example:**
```bash
curl -X GET "https://api.rappit.io/orders/order-123/timeline" \
  -H "Authorization: Bearer <token>"
```

---

### 7. **DELETE /orders/:id** - Delete Order

**Description:** Delete an order (only allowed for NEW or CANCELLED orders)

**Access:** `ADMIN` only

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Order ID |

**Response:**
```json
{
  "message": "Order deleted successfully"
}
```

**Restrictions:**
- ✅ Only NEW or CANCELLED orders can be deleted
- ✅ Cannot delete orders with active reservations
- ✅ Cannot delete orders that have been shipped
- ✅ ADMIN role required

**Error Responses:**

**400 Bad Request** - Cannot delete:
```json
{
  "statusCode": 400,
  "message": "Cannot delete order in status RESERVED. Only NEW or CANCELLED orders can be deleted.",
  "error": "Bad Request"
}
```

**cURL Example:**
```bash
curl -X DELETE "https://api.rappit.io/orders/order-123" \
  -H "Authorization: Bearer <token>"
```

---

## 🔐 Role-Based Access Control (RBAC)

### Permissions Matrix

| Endpoint | OPERATOR | MANAGER | ADMIN |
|----------|----------|---------|-------|
| `GET /orders` | ✅ | ✅ | ✅ |
| `GET /orders/:id` | ✅ | ✅ | ✅ |
| `POST /orders` | ❌ | ✅ | ✅ |
| `PATCH /orders/:id/status` | ❌ | ✅ | ✅ |
| `POST /orders/:id/notes` | ✅ | ✅ | ✅ |
| `GET /orders/:id/timeline` | ✅ | ✅ | ✅ |
| `DELETE /orders/:id` | ❌ | ❌ | ✅ |

### Role Descriptions

**OPERATOR:**
- View orders
- View order details
- Add notes
- View timeline
- Cannot create orders or change status

**MANAGER:**
- All OPERATOR permissions
- Import orders from channels
- Update order status (manual)
- Cannot delete orders

**ADMIN:**
- All MANAGER permissions
- Delete orders
- Full system access

### RBAC Implementation

**Guards:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
```

**Decorator:**
```typescript
@Roles('OPERATOR', 'MANAGER', 'ADMIN')
```

**Example:**
```typescript
@Get()
@Roles('OPERATOR', 'MANAGER', 'ADMIN')
async findAll(...) {
  // Only users with OPERATOR, MANAGER, or ADMIN role can access
}

@Delete(':id')
@Roles('ADMIN')
async delete(...) {
  // Only ADMIN users can access
}
```

---

## 🌍 Multi-Tenancy & Organization Scoping

### Automatic Organization Scoping

All endpoints automatically enforce organization-level isolation using the `@OrganizationId()` decorator:

```typescript
@Get()
async findAll(
  @OrganizationId() organizationId: string, // Extracted from JWT
  @Query() filters: FilterOrdersDto,
) {
  return this.ordersService.findAll(organizationId, filters);
}
```

### How It Works

1. User authenticates with JWT
2. JWT contains `organizationId`
3. `@OrganizationId()` decorator extracts it
4. Service methods enforce org scoping in all queries
5. Users can only access their organization's data

### Security Guarantees

✅ Users cannot access other organization's orders
✅ All DB queries include `organizationId` filter
✅ Enforced at service layer (defense in depth)
✅ No cross-org data leakage

---

## 🎭 Actor Tracking

Every action is tracked with actor information for audit trails:

### Actor Types

```typescript
enum ActorType {
  USER = 'USER',       // Human user via UI/API
  SYSTEM = 'SYSTEM',   // Automated system action
  CHANNEL = 'CHANNEL', // Sales channel webhook (Shopify, WooCommerce)
  CARRIER = 'CARRIER', // Shipping carrier webhook (DHL, FedEx)
  API = 'API',         // Third-party API integration
}
```

### Actor Tracking in Controller

```typescript
@Patch(':id/status')
async updateStatus(
  @CurrentUser() user: CurrentUserPayload, // Contains userId, email, role
  ...
) {
  return this.ordersService.updateOrderStatus(
    orderId,
    newStatus,
    ActorType.USER,    // Actor type
    user.userId,       // Actor ID
    organizationId,
    comment,
  );
}
```

### Timeline Events with Actor

Every timeline event records:
- `actorType` - Type of actor (USER, SYSTEM, etc.)
- `actorId` - User ID or system identifier
- `description` - Human-readable description
- `metadata` - Additional context

**Example Timeline Event:**
```json
{
  "eventType": "status_changed",
  "actorType": "USER",
  "actorId": "user-manager-456",
  "fromStatus": "RESERVED",
  "toStatus": "READY_TO_SHIP",
  "description": "Payment confirmed",
  "createdAt": "2024-12-11T13:00:00Z"
}
```

---

## 📊 Error Handling

### Standard HTTP Status Codes

| Status Code | Meaning | When |
|-------------|---------|------|
| 200 OK | Success | GET, PATCH, DELETE successful |
| 201 Created | Resource created | POST successful |
| 400 Bad Request | Invalid input | Validation error, invalid state transition |
| 401 Unauthorized | Authentication failed | Missing or invalid JWT token |
| 403 Forbidden | Insufficient permissions | RBAC check failed |
| 404 Not Found | Resource not found | Order doesn't exist or wrong org |
| 500 Internal Server Error | Server error | Unexpected error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Invalid state transition from NEW to DELIVERED",
  "error": "Bad Request"
}
```

### Common Errors

**Invalid State Transition:**
```json
{
  "statusCode": 400,
  "message": "Invalid state transition from DELIVERED to NEW",
  "error": "Bad Request"
}
```

**Order Not Found:**
```json
{
  "statusCode": 404,
  "message": "Order not found",
  "error": "Not Found"
}
```

**Insufficient Permissions:**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: MANAGER, ADMIN",
  "error": "Forbidden"
}
```

**Validation Error:**
```json
{
  "statusCode": 400,
  "message": [
    "status should not be empty",
    "status must be a valid enum value"
  ],
  "error": "Bad Request"
}
```

**Insufficient Inventory:**
```json
{
  "statusCode": 400,
  "message": "Status updated but inventory reservation failed: Insufficient stock for SKU LAPTOP-HP-15",
  "error": "Bad Request"
}
```

---

## 🧪 Testing

### Unit Tests (`orders.controller.spec.ts`)

**Coverage:**
- ✅ RBAC enforcement for all endpoints
- ✅ Organization scoping
- ✅ Actor tracking
- ✅ Error handling (404, 403)
- ✅ DTO validation
- ✅ Logging

**Run:**
```bash
npm run test -- orders.controller.spec.ts
```

### E2E Tests (`test/orders.e2e-spec.ts`)

**Coverage:**
- ✅ Full order lifecycle (create → status transitions → delete)
- ✅ Inventory integration (reserve → release)
- ✅ State machine validation
- ✅ RBAC for all roles (OPERATOR, MANAGER, ADMIN)
- ✅ Idempotency
- ✅ Multi-tenancy
- ✅ Timeline events

**Run:**
```bash
npm run test:e2e -- orders.e2e-spec.ts
```

---

## 📝 Usage Examples

### Example 1: Shopify Webhook - New Order

```typescript
// Webhook handler receives order.created from Shopify
app.post('/webhooks/shopify/orders/create', async (req, res) => {
  const shopifyPayload = req.body;

  // Map Shopify payload to our DTO
  const orderDto = {
    channelId: 'shopify-channel-123',
    externalOrderId: shopifyPayload.id.toString(),
    customer: {
      externalId: shopifyPayload.customer.id.toString(),
      firstName: shopifyPayload.customer.first_name,
      lastName: shopifyPayload.customer.last_name,
      email: shopifyPayload.customer.email,
    },
    shippingAddress: {
      firstName: shopifyPayload.shipping_address.first_name,
      lastName: shopifyPayload.shipping_address.last_name,
      street1: shopifyPayload.shipping_address.address1,
      city: shopifyPayload.shipping_address.city,
      postalCode: shopifyPayload.shipping_address.zip,
      country: shopifyPayload.shipping_address.country_code,
    },
    items: shopifyPayload.line_items.map(item => ({
      externalItemId: item.id.toString(),
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: parseFloat(item.price),
      totalPrice: parseFloat(item.price) * item.quantity,
    })),
    subtotal: parseFloat(shopifyPayload.subtotal_price),
    taxAmount: parseFloat(shopifyPayload.total_tax),
    totalAmount: parseFloat(shopifyPayload.total_price),
    currency: shopifyPayload.currency,
  };

  // Import order via API
  const order = await fetch('https://api.rappit.io/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WEBHOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderDto),
  });

  // Order created, inventory reserved, status = RESERVED
  res.json({ received: true });
});
```

### Example 2: Manager UI - Update Order Status

```typescript
// Manager confirms payment and moves order to READY_TO_SHIP
async function confirmPayment(orderId: string) {
  const response = await fetch(`https://api.rappit.io/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${MANAGER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'READY_TO_SHIP',
      comment: 'Payment confirmed via bank transfer',
    }),
  });

  const order = await response.json();
  console.log(`Order ${order.orderNumber} is ready to ship!`);
}
```

### Example 3: Operator UI - Add Note

```typescript
// Operator adds note after customer call
async function addCustomerNote(orderId: string, note: string) {
  await fetch(`https://api.rappit.io/orders/${orderId}/notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPERATOR_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note }),
  });

  console.log('Note added successfully');
}

// Usage
await addCustomerNote(
  'order-123',
  'Customer confirmed delivery address: Building 12, Floor 3'
);
```

### Example 4: Admin UI - Cancel Order

```typescript
// Admin cancels order (releases inventory)
async function cancelOrder(orderId: string, reason: string) {
  const response = await fetch(`https://api.rappit.io/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'CANCELLED',
      comment: reason,
    }),
  });

  if (response.ok) {
    console.log('Order cancelled, inventory released');
  }
}

// Usage
await cancelOrder('order-123', 'Customer requested cancellation');
```

### Example 5: Filter & Search Orders

```typescript
// Get all RESERVED orders from Shopify channel for last 7 days
async function getRecentReservedOrders() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    status: 'RESERVED',
    channelId: 'shopify-channel-123',
    startDate: sevenDaysAgo.toISOString(),
    page: '1',
    limit: '50',
  });

  const response = await fetch(`https://api.rappit.io/orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${MANAGER_TOKEN}`,
    },
  });

  const { data, meta } = await response.json();
  console.log(`Found ${meta.total} RESERVED orders`);
  return data;
}

// Search orders by customer name
async function searchOrders(query: string) {
  const params = new URLSearchParams({
    search: query,
    page: '1',
    limit: '20',
  });

  const response = await fetch(`https://api.rappit.io/orders?${params}`, {
    headers: {
      'Authorization': `Bearer ${OPERATOR_TOKEN}`,
    },
  });

  return await response.json();
}
```

---

## 🔧 Integration Guide

### Integrating with Frontend (React/Vue/Angular)

```typescript
// api/orders.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.rappit.io',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Orders API client
export const ordersApi = {
  list: (filters) => api.get('/orders', { params: filters }),
  get: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status, comment) =>
    api.patch(`/orders/${id}/status`, { status, comment }),
  addNote: (id, note) =>
    api.post(`/orders/${id}/notes`, { note }),
  getTimeline: (id) =>
    api.get(`/orders/${id}/timeline`),
};

// Usage in component
const orders = await ordersApi.list({ status: 'RESERVED' });
```

### Integrating with Mobile App (React Native)

```typescript
// hooks/useOrders.ts
import { useState, useEffect } from 'react';
import { ordersApi } from '../api/orders';

export function useOrders(filters) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await ordersApi.list(filters);
        setOrders(response.data.data);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [filters]);

  return { orders, loading };
}

// Usage in screen
function OrdersScreen() {
  const { orders, loading } = useOrders({ status: 'RESERVED' });

  if (loading) return <LoadingSpinner />;

  return (
    <FlatList
      data={orders}
      renderItem={({ item }) => <OrderCard order={item} />}
    />
  );
}
```

---

## 📦 Files Created/Updated

### Created:
- `/src/modules/orders/orders.controller.ts` (complete rewrite - comprehensive REST API)
- `/src/modules/orders/orders.controller.spec.ts` (unit tests)
- `/test/orders.e2e-spec.ts` (e2e integration tests)
- `/ORDERS_CONTROLLER_COMPLETE.md` (this documentation)

### Updated:
- `/src/modules/orders/dto/update-order-status.dto.ts` (added comment field)

---

## ✅ Completion Checklist

- ✅ All 7 endpoints implemented
- ✅ RBAC enforcement on all endpoints
- ✅ Organization scoping enforced
- ✅ Actor tracking implemented
- ✅ State machine validation
- ✅ Comprehensive error handling
- ✅ OpenAPI/Swagger documentation
- ✅ Unit tests (controller.spec.ts)
- ✅ E2E tests (orders.e2e-spec.ts)
- ✅ Logging implemented
- ✅ Multi-tenancy enforced
- ✅ JWT authentication required
- ✅ Complete documentation

---

## 🎉 Status: **PRODUCTION READY**

The OrdersController implements a complete, production-grade REST API with:
- ✅ Full CRUD operations
- ✅ RBAC enforcement
- ✅ State machine validation
- ✅ Inventory integration
- ✅ Multi-tenant isolation
- ✅ Audit trail
- ✅ Comprehensive testing
- ✅ Complete documentation

**All 4 phases of the Rappit Orders module are now complete!** 🚀
