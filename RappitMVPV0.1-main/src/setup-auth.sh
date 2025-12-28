#!/bin/bash

# Rappit Authentication Setup Script
# This script sets up the database and seeds it with demo data

set -e

echo "🚀 Rappit Authentication Setup"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f .env ] && [ ! -f .env.local ]; then
    echo "⚠️  No .env file found. Creating .env.local..."
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://rappit:rappit123@localhost:5432/rappit?schema=public"

# JWT
JWT_SECRET="rappit-dev-secret-change-in-production-min-32-chars"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Server
PORT="3000"
NODE_ENV="development"

# CORS
CORS_ORIGIN="*"
EOF
    echo "✓ Created .env.local with default settings"
    echo ""
fi

# Start Docker containers
echo "📦 Starting Docker containers (PostgreSQL & Redis)..."
if ! docker-compose up -d postgres redis; then
    echo "❌ Failed to start Docker containers"
    echo "   Make sure Docker is installed and running"
    exit 1
fi
echo "✓ Docker containers started"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3
until docker-compose exec -T postgres pg_isready -U rappit > /dev/null 2>&1; do
    echo "   Still waiting..."
    sleep 2
done
echo "✓ PostgreSQL is ready"
echo ""

# Install dependencies
echo "📚 Installing dependencies..."
if ! npm install > /dev/null 2>&1; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"
echo ""

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
if ! npx prisma generate > /dev/null 2>&1; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✓ Prisma Client generated"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
if ! npx prisma migrate deploy; then
    echo "❌ Failed to run migrations"
    exit 1
fi
echo "✓ Migrations completed"
echo ""

# Seed database
echo "🌱 Seeding database with demo data..."
if ! npm run prisma:seed; then
    echo "❌ Failed to seed database"
    exit 1
fi
echo "✓ Database seeded"
echo ""

echo "✅ Setup complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Demo Credentials:"
echo ""
echo "   Admin:    admin@rappit.demo    / admin123"
echo "   Manager:  manager@rappit.demo  / manager123"
echo "   Operator: operator@rappit.demo / operator123"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "   1. Start the development server:"
echo "      npm run start:dev"
echo ""
echo "   2. Open API documentation:"
echo "      http://localhost:3000/api/docs"
echo ""
echo "   3. Test authentication:"
echo "      See AUTH_TESTING.md for examples"
echo "      or use test-auth.http with REST Client"
echo ""
echo "   4. Access Prisma Studio (optional):"
echo "      npm run prisma:studio"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
