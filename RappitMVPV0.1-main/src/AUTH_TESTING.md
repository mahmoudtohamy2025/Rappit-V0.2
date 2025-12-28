# Rappit Authentication Testing Guide

This guide demonstrates how to test the complete authentication, authorization, and multi-tenancy system.

## Setup

1. **Start the database:**
```bash
docker-compose up -d postgres redis
```

2. **Run migrations:**
```bash
npx prisma migrate deploy
```

3. **Start the backend:**
```bash
npm run start:dev
```

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### 1. Register New User & Organization

**Endpoint:** `POST /auth/register`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "organizationName": "Cairo Electronics Store"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "firstName": "Ahmed",
    "lastName": "Hassan"
  },
  "organization": {
    "id": "org-uuid-here",
    "name": "Cairo Electronics Store",
    "role": "ADMIN"
  }
}
```

**What happens:**
- Creates a new user
- Creates a new organization
- Creates a UserOrganization membership with ADMIN role
- Returns JWT token with user + organization context

---

### 2. Login

**Endpoint:** `POST /auth/login`

**Request (simple login):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!"
  }'
```

**Request (login to specific organization):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123!",
    "organizationId": "org-uuid-here"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "firstName": "Ahmed",
    "lastName": "Hassan"
  },
  "organization": {
    "id": "org-uuid-here",
    "name": "Cairo Electronics Store",
    "role": "ADMIN"
  },
  "availableOrganizations": [
    {
      "id": "org-uuid-here",
      "name": "Cairo Electronics Store",
      "role": "ADMIN"
    }
  ]
}
```

---

### 3. Get Current User Info

**Endpoint:** `GET /auth/me`

**Request:**
```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "admin@example.com",
    "firstName": "Ahmed",
    "lastName": "Hassan",
    "isActive": true,
    "lastLoginAt": "2024-12-11T10:00:00.000Z"
  },
  "currentOrganization": {
    "id": "org-uuid-here",
    "name": "Cairo Electronics Store",
    "role": "ADMIN",
    "settings": {}
  },
  "availableOrganizations": [
    {
      "id": "org-uuid-here",
      "name": "Cairo Electronics Store",
      "role": "ADMIN"
    }
  ]
}
```

---

### 4. Get Current Organization

**Endpoint:** `GET /organizations/current`

**Request:**
```bash
curl -X GET http://localhost:3000/api/v1/organizations/current \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response:**
```json
{
  "id": "org-uuid-here",
  "name": "Cairo Electronics Store",
  "settings": {},
  "createdAt": "2024-12-11T10:00:00.000Z",
  "updatedAt": "2024-12-11T10:00:00.000Z",
  "members": [
    {
      "id": "user-uuid",
      "email": "admin@example.com",
      "firstName": "Ahmed",
      "lastName": "Hassan",
      "isActive": true,
      "role": "ADMIN",
      "joinedAt": "2024-12-11T10:00:00.000Z"
    }
  ],
  "stats": {
    "channels": 0,
    "products": 0,
    "orders": 0,
    "customers": 0,
    "shipments": 0
  }
}
```

---

### 5. Invite User to Organization (ADMIN only)

**Endpoint:** `POST /users`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@example.com",
    "firstName": "Fatima",
    "lastName": "Ahmed",
    "password": "TempPass123!",
    "role": "OPERATOR"
  }'
```

**Response:**
```json
{
  "id": "new-user-uuid",
  "email": "operator@example.com",
  "firstName": "Fatima",
  "lastName": "Ahmed",
  "role": "OPERATOR",
  "membershipId": "membership-uuid"
}
```

---

### 6. List Organization Users

**Endpoint:** `GET /users`

**Request:**
```bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### 7. Update User Role (ADMIN only)

**Endpoint:** `PATCH /users/:id`

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/user-uuid-here \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "MANAGER"
  }'
```

---

### 8. Update Organization Settings (ADMIN only)

**Endpoint:** `PATCH /organizations/current`

**Request:**
```bash
curl -X PATCH http://localhost:3000/api/v1/organizations/current \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Store Name",
    "settings": {
      "timezone": "Africa/Cairo",
      "currency": "EGP",
      "language": "ar"
    }
  }'
```

---

## JWT Token Structure

The JWT token contains:

```json
{
  "sub": "user-uuid",       // User ID
  "orgId": "org-uuid",      // Organization ID
  "role": "ADMIN",          // User's role in this organization
  "iat": 1702294800,
  "exp": 1702899600
}
```

This ensures:
- ✅ Every request is scoped to a specific organization
- ✅ Role-based access control is enforced
- ✅ Multi-tenancy is automatic and transparent

---

## Role-Based Access Control

### Roles (from least to most privileged):

1. **OPERATOR** - Execute operations only
   - View orders, shipments, inventory
   - Create shipments
   - Update order status
   - Cannot modify settings or users

2. **MANAGER** - Manage operations
   - All OPERATOR permissions
   - Create/update channels
   - Manage inventory
   - Cannot manage users or organization settings

3. **ADMIN** - Full access
   - All MANAGER permissions
   - Invite/remove users
   - Update user roles
   - Modify organization settings

### Using @Roles() Decorator:

```typescript
@Roles('ADMIN')           // Only ADMIN
@Roles('ADMIN', 'MANAGER')  // ADMIN or MANAGER
```

---

## Testing Authorization

### Test 1: Protected Endpoint (requires auth)
```bash
# Without token - should fail with 401
curl -X GET http://localhost:3000/api/v1/users

# With token - should succeed
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test 2: Admin-Only Endpoint
```bash
# As OPERATOR - should fail with 403
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", ...}'

# As ADMIN - should succeed
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", ...}'
```

### Test 3: Organization Scoping
All queries are automatically scoped to the organization in the JWT token.

```bash
# User A (org 1) cannot see User B's (org 2) data
# Each organization's data is completely isolated
```

---

## Public Endpoints (No Auth Required)

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`
- `GET /health/ready`
- `GET /health/live`

---

## Error Responses

### 401 Unauthorized (Missing/Invalid Token)
```json
{
  "statusCode": 401,
  "message": "Invalid or missing token",
  "error": "Unauthorized"
}
```

### 403 Forbidden (Insufficient Permissions)
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: ADMIN",
  "error": "Forbidden"
}
```

### 409 Conflict (Email Already Exists)
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

---

## Quick Test Script

Save this as `test-auth.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3000/api/v1"

echo "1. Testing health endpoint (public)..."
curl -s $API_URL/health | jq

echo -e "\n2. Registering new user..."
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@rappit.local",
    "password": "Test123456!",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Org"
  }')

echo $RESPONSE | jq

TOKEN=$(echo $RESPONSE | jq -r '.access_token')

echo -e "\n3. Getting current user info..."
curl -s -X GET $API_URL/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\n4. Getting organization info..."
curl -s -X GET $API_URL/organizations/current \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\n5. Listing users..."
curl -s -X GET $API_URL/users \
  -H "Authorization: Bearer $TOKEN" | jq

echo -e "\nDone! Save your token: $TOKEN"
```

Run with:
```bash
chmod +x test-auth.sh
./test-auth.sh
```

---

## Summary

✅ **Authentication:** Email + password with JWT tokens
✅ **Multi-tenancy:** Organization scoping in JWT
✅ **RBAC:** Three roles with @Roles() decorator
✅ **Global Guards:** Applied automatically to all routes
✅ **Public Routes:** Use @Public() decorator
✅ **Organization Isolation:** Complete data separation

The system is production-ready and follows NestJS best practices!
