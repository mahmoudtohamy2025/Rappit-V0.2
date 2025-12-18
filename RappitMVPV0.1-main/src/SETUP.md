# Rappit Backend Setup Guide

This guide will walk you through setting up the Rappit backend from scratch.

## Prerequisites

Ensure you have the following installed:
- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Git

Alternatively, you can use Docker:
- Docker
- Docker Compose

## Quick Start with Docker

The easiest way to get started is using Docker Compose for the database and Redis:

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd rappit-backend

# Install dependencies
npm install
```

## Step 2: Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and configure your settings
nano .env  # or use your preferred editor
```

### Essential Environment Variables

```env
# Database - Update if not using docker-compose
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rappit_db?schema=public"

# JWT Secret - MUST CHANGE in production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Redis - Update if not using docker-compose
REDIS_HOST=localhost
REDIS_PORT=6379

# Application URL
APP_URL=http://localhost:3000
```

## Step 3: Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with demo data (optional)
npm run prisma:seed
```

After seeding, you'll have demo credentials:
- **Admin**: `admin@rappit.demo` / `admin123`
- **Operator**: `operator@rappit.demo` / `operator123`

## Step 4: Run the Application

```bash
# Development mode with hot-reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server will start on http://localhost:3000

## Step 5: Verify Installation

### Health Check
```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### API Documentation
Open your browser and visit:
- **Swagger UI**: http://localhost:3000/api/docs

## Step 6: Test Authentication

### Register a new organization
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Organization"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rappit.demo",
    "password": "admin123"
  }'
```

Save the returned `access_token` for authenticated requests.

## Using the API

All authenticated endpoints require a Bearer token:

```bash
# Example: Get current user
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Development Tools

### Prisma Studio (Database GUI)
```bash
npm run prisma:studio
```
Opens at http://localhost:5555

### View Queue Jobs (Optional)
You can use a tool like Bull Board to monitor BullMQ queues.

## Common Issues

### Database Connection Error
- Verify PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL in .env
- Ensure the database exists

### Redis Connection Error
- Verify Redis is running: `docker-compose ps`
- Check REDIS_HOST and REDIS_PORT in .env

### Port Already in Use
- Change the PORT in .env
- Check if another process is using port 3000

### Migration Errors
```bash
# Reset database (⚠️ This will delete all data)
npm run prisma:migrate reset

# Then re-run migrations
npm run prisma:migrate
npm run prisma:seed
```

## Production Deployment

### 1. Environment Variables
Update all environment variables for production:
- Set strong JWT_SECRET
- Use production database URL
- Configure production Redis
- Set NODE_ENV=production

### 2. Build
```bash
npm run build
```

### 3. Run Migrations
```bash
npm run prisma:deploy
```

### 4. Start Application
```bash
npm run start:prod
```

### 5. Process Manager (Recommended)
Use PM2 or similar:
```bash
npm install -g pm2
pm2 start dist/main.js --name rappit-backend
pm2 save
pm2 startup
```

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Next Steps

1. **Configure Sales Channels**: Add Shopify or WooCommerce channels via API
2. **Set up Webhooks**: Configure webhooks from your sales platforms
3. **Configure Shipping**: Add DHL/FedEx API credentials
4. **Import Orders**: Start importing orders from your channels
5. **Manage Inventory**: Set up your product inventory

## Support

For issues or questions:
1. Check the main README.md
2. Review API documentation at /api/docs
3. Check application logs
4. Contact the development team

## Useful Commands

```bash
# View logs in development
npm run start:dev

# Check code style
npm run lint

# Format code
npm run format

# Database commands
npm run prisma:studio       # Open database GUI
npm run prisma:generate     # Regenerate Prisma client
npm run prisma:migrate      # Run migrations
npm run prisma:seed         # Seed database
```

## Architecture Overview

```
Client Request
     ↓
API Gateway (NestJS)
     ↓
JWT Authentication
     ↓
Organization Isolation
     ↓
Business Logic (Services)
     ↓
Database (PostgreSQL via Prisma)
     ↓
Background Jobs (BullMQ + Redis)
     ↓
External APIs (Shopify, WooCommerce, DHL, FedEx)
```

## Security Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Use HTTPS in production
- [ ] Configure proper CORS_ORIGIN
- [ ] Set strong database passwords
- [ ] Enable database SSL in production
- [ ] Regularly update dependencies
- [ ] Set up proper logging and monitoring
- [ ] Configure rate limiting (recommended)
- [ ] Use environment variables for all secrets

---

🚀 You're ready to use Rappit!
