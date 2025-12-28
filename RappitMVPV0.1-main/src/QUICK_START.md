# 🚀 Rappit Authentication - Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Docker & Docker Compose installed
- PostgreSQL (via Docker)
- Redis (via Docker)

## Setup (2 minutes)

```bash
# 1. Run the setup script
chmod +x setup-auth.sh
./setup-auth.sh

# 2. Start the development server
npm run start:dev
```

Done! 🎉

## Test Authentication (30 seconds)

```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rappit.demo",
    "password": "admin123"
  }'

# 2. Copy the access_token from response

# 3. Get your user info
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@rappit.demo | admin123 | ADMIN |
| manager@rappit.demo | manager123 | MANAGER |
| operator@rappit.demo | operator123 | OPERATOR |

## Key Endpoints

```
POST   /api/v1/auth/register       - Register new user + org
POST   /api/v1/auth/login          - Login
GET    /api/v1/auth/me             - Current user info
GET    /api/v1/organizations/current - Current organization
GET    /api/v1/users               - List users (needs auth)
```

## Authorization Examples

### Mark Route as Public
```typescript
@Public()
@Post('login')
async login() { ... }
```

### Require Admin Role
```typescript
@Roles('ADMIN')
@Post('users')
async inviteUser() { ... }
```

### Get Current User
```typescript
async myEndpoint(@CurrentUser() user: CurrentUserPayload) {
  console.log(user.userId);
  console.log(user.organizationId);
  console.log(user.role);
}
```

### Get Organization ID
```typescript
async myEndpoint(@CurrentOrganization() orgId: string) {
  return this.service.findAll(orgId);
}
```

## Common Commands

```bash
# Database
npm run prisma:migrate       # Run new migration
npm run prisma:deploy        # Deploy migrations
npm run prisma:seed          # Seed demo data
npm run prisma:studio        # Open Prisma Studio

# Development
npm run start:dev            # Start dev server
npm run build                # Build for production
npm run start:prod           # Run production build

# Docker
docker-compose up -d         # Start all services
docker-compose down          # Stop all services
docker-compose logs -f       # View logs
```

## Useful URLs

- **API Base:** http://localhost:3000/api/v1
- **API Docs:** http://localhost:3000/api/docs
- **Health:** http://localhost:3000/api/v1/health
- **Prisma Studio:** http://localhost:5555 (after `npm run prisma:studio`)

## Troubleshooting

### "Cannot connect to database"
```bash
# Make sure PostgreSQL is running
docker-compose up -d postgres
```

### "JWT secret error"
```bash
# Make sure .env or .env.local exists with JWT_SECRET
echo 'JWT_SECRET="your-secret-min-32-chars"' >> .env.local
```

### "Prisma Client not found"
```bash
# Generate Prisma Client
npx prisma generate
```

### "Migration failed"
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Need More Help?

- **Testing Guide:** See `AUTH_TESTING.md`
- **Implementation Guide:** See `AUTH_IMPLEMENTATION.md`
- **Summary:** See `AUTH_SUMMARY.md`
- **HTTP Tests:** Use `test-auth.http` with REST Client

## Architecture Overview

```
User Request
    ↓
JwtAuthGuard (validates token)
    ↓
RolesGuard (checks @Roles())
    ↓
Controller (gets @CurrentUser())
    ↓
Service (scopes by organizationId)
    ↓
Database (multi-tenant isolated)
```

## Security Defaults

- ✅ All routes protected by default
- ✅ JWT expires in 7 days
- ✅ Passwords hashed with bcrypt
- ✅ Organization data completely isolated
- ✅ Role-based access control enforced

---

**Ready to build!** 🎯

Start developing your features using the authentication system.
All routes are automatically protected and organization-scoped!
