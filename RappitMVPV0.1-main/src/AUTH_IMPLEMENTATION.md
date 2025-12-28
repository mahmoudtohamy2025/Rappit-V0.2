# Authentication & Authorization Implementation Guide

## Overview

Rappit uses a production-grade authentication system with JWT tokens, role-based access control (RBAC), and automatic multi-tenancy enforcement.

## Architecture

```
┌─────────────────┐
│  HTTP Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  JwtAuthGuard   │ ◄── Global, validates JWT & extracts user
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RolesGuard     │ ◄── Global, enforces @Roles() decorator
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Controller    │ ◄── Access user via @CurrentUser()
└─────────────────┘
```

## Key Components

### 1. Guards

**JwtAuthGuard** (`/src/common/guards/jwt-auth.guard.ts`)
- Applied globally via `APP_GUARD`
- Validates JWT tokens from `Authorization: Bearer <token>` header
- Extracts user info and attaches to `request.user`
- Bypassed for routes with `@Public()` decorator

**RolesGuard** (`/src/common/guards/roles.guard.ts`)
- Applied globally via `APP_GUARD`
- Enforces role requirements from `@Roles()` decorator
- Only activates when `@Roles()` is present
- Returns 403 Forbidden if user lacks required role

### 2. Decorators

**@Public()** - Mark routes as public (no auth required)
```typescript
@Public()
@Post('login')
async login() { ... }
```

**@Roles()** - Require specific roles
```typescript
@Roles('ADMIN')           // Only ADMIN
@Roles('ADMIN', 'MANAGER') // ADMIN or MANAGER
@Post('users')
async inviteUser() { ... }
```

**@CurrentUser()** - Get authenticated user
```typescript
async getProfile(@CurrentUser() user: CurrentUserPayload) {
  // user.userId
  // user.email
  // user.organizationId
  // user.role
}
```

**@CurrentOrganization()** - Get current organization ID
```typescript
async getOrders(@CurrentOrganization() orgId: string) {
  // orgId extracted from JWT
}
```

### 3. JWT Payload Structure

```typescript
{
  sub: string;      // User ID
  orgId: string;    // Organization ID
  role: UserRole;   // User's role in this org
  iat: number;      // Issued at
  exp: number;      // Expires at
}
```

### 4. User Roles

```typescript
enum UserRole {
  ADMIN    // Full access - can manage users, settings
  MANAGER  // Can manage operations - channels, inventory
  OPERATOR // Can execute operations - process orders, create shipments
}
```

**Role Hierarchy:**
```
ADMIN
  └─ MANAGER
      └─ OPERATOR
```

## Usage Examples

### Protected Endpoint (Default)

All endpoints are protected by default. No decorator needed.

```typescript
@Controller('orders')
export class OrdersController {
  // Automatically requires authentication
  @Get()
  async findAll(@CurrentOrganization() orgId: string) {
    // Only returns orders for user's current organization
    return this.ordersService.findAll(orgId);
  }
}
```

### Public Endpoint

```typescript
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

### Admin-Only Endpoint

```typescript
@Controller('users')
export class UsersController {
  @Post()
  @Roles('ADMIN')
  async inviteUser(
    @Body() dto: CreateUserDto,
    @CurrentOrganization() orgId: string,
  ) {
    return this.usersService.create(dto, orgId);
  }
}
```

### Multi-Role Endpoint

```typescript
@Controller('inventory')
export class InventoryController {
  @Post('adjust')
  @Roles('ADMIN', 'MANAGER')
  async adjustInventory(
    @Body() dto: AdjustInventoryDto,
    @CurrentOrganization() orgId: string,
  ) {
    return this.inventoryService.adjust(dto, orgId);
  }
}
```

### Full User Context

```typescript
@Controller('profile')
export class ProfileController {
  @Get()
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    return {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      organizationId: user.organizationId,
      role: user.role,
    };
  }
}
```

## Multi-Tenancy Enforcement

### Automatic Organization Scoping

Every authenticated request includes `organizationId` from the JWT token. Services should use this to scope all database queries:

```typescript
@Injectable()
export class OrdersService {
  async findAll(organizationId: string) {
    return this.prisma.order.findMany({
      where: { organizationId }, // Always scope by org
    });
  }

  async findOne(id: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id,
        organizationId, // Prevents cross-org access
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async create(dto: CreateOrderDto, organizationId: string) {
    return this.prisma.order.create({
      data: {
        ...dto,
        organizationId, // Always set org on create
      },
    });
  }
}
```

### Service Pattern

```typescript
// ✅ CORRECT - Always pass organizationId
@Controller('orders')
export class OrdersController {
  @Get()
  findAll(@CurrentOrganization() orgId: string) {
    return this.ordersService.findAll(orgId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentOrganization() orgId: string,
  ) {
    return this.ordersService.findOne(id, orgId);
  }
}

// ❌ WRONG - Missing organization scoping
@Controller('orders')
export class OrdersController {
  @Get()
  findAll() {
    return this.ordersService.findAll(); // Missing orgId!
  }
}
```

## Authorization Patterns

### Role-Based Access

```typescript
// Only admins can delete
@Delete(':id')
@Roles('ADMIN')
async remove(@Param('id') id: string) { ... }

// Admins and managers can update
@Patch(':id')
@Roles('ADMIN', 'MANAGER')
async update(@Param('id') id: string) { ... }

// All authenticated users can read
@Get()
async findAll() { ... }
```

### Service-Level Authorization

For complex authorization logic, implement in services:

```typescript
@Injectable()
export class UsersService {
  async updateRole(
    userId: string,
    organizationId: string,
    newRole: UserRole,
    updatedByRole: UserRole,
  ) {
    // Only ADMIN can update roles
    if (updatedByRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update user roles');
    }

    // Prevent removing last admin
    if (newRole !== 'ADMIN') {
      const adminCount = await this.prisma.userOrganization.count({
        where: { organizationId, role: 'ADMIN' },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last admin from the organization',
        );
      }
    }

    // Perform update
    // ...
  }
}
```

## Testing Authentication

### Test Flow

```bash
# 1. Register (creates user + org)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Test123456!",
    "firstName": "Test",
    "lastName": "User",
    "organizationName": "Test Org"
  }'

# Save the access_token from response

# 2. Access protected endpoint
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Test RBAC
# Try accessing admin-only endpoint with operator token
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "new@test.com", ...}'
# Should return 403 Forbidden
```

### Seed Data

Run the seed to create test users:

```bash
npx prisma db seed
```

This creates:
- `admin@rappit.demo` / `admin123` (ADMIN)
- `manager@rappit.demo` / `manager123` (MANAGER)
- `operator@rappit.demo` / `operator123` (OPERATOR)

## Security Best Practices

### 1. Always Validate Organization Access

```typescript
// ✅ CORRECT
async findOne(id: string, organizationId: string) {
  const order = await this.prisma.order.findFirst({
    where: { id, organizationId },
  });

  if (!order) {
    throw new NotFoundException('Order not found');
  }

  return order;
}

// ❌ WRONG - Allows cross-org access
async findOne(id: string) {
  return this.prisma.order.findFirst({
    where: { id },
  });
}
```

### 2. Use @Roles() for Sensitive Operations

```typescript
// ✅ CORRECT
@Delete(':id')
@Roles('ADMIN')
async deleteUser() { ... }

// ❌ WRONG - Anyone can delete
@Delete(':id')
async deleteUser() { ... }
```

### 3. Validate Role in Services

For complex authorization:

```typescript
async removeUser(userId: string, orgId: string, removedByRole: UserRole) {
  if (removedByRole !== 'ADMIN') {
    throw new ForbiddenException('Only admins can remove users');
  }
  // ...
}
```

### 4. Password Security

```typescript
// Hash passwords before storing
const passwordHash = await bcrypt.hash(password, 10);

// Verify during login
const isValid = await bcrypt.compare(password, user.passwordHash);
```

### 5. JWT Security

- Set appropriate expiration (7 days default)
- Use strong secret (min 32 characters)
- Store JWT_SECRET in environment variables
- Never expose JWT_SECRET in code

## Configuration

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/rappit
JWT_SECRET=your-super-secret-key-min-32-chars

# Optional
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

### JWT Configuration

Edit `/src/config/configuration.ts`:

```typescript
jwt: {
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
}
```

## Common Issues

### Issue: 401 Unauthorized on all requests

**Cause:** Missing or invalid JWT token
**Solution:** Ensure `Authorization: Bearer <token>` header is present

### Issue: 403 Forbidden on admin endpoints

**Cause:** User lacks required role
**Solution:** Login with admin account or adjust @Roles()

### Issue: Can see other organization's data

**Cause:** Missing organizationId in query
**Solution:** Always pass organizationId from @CurrentOrganization()

### Issue: JWT expired

**Cause:** Token older than JWT_EXPIRES_IN
**Solution:** Login again to get new token

## Extending the System

### Adding New Role

1. Update Prisma schema:
```prisma
enum UserRole {
  ADMIN
  MANAGER
  OPERATOR
  VIEWER    // New role
}
```

2. Run migration:
```bash
npx prisma migrate dev --name add_viewer_role
```

3. Use in @Roles():
```typescript
@Roles('ADMIN', 'MANAGER', 'VIEWER')
```

### Adding Custom Guard

```typescript
@Injectable()
export class CustomGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Custom logic
    return someCondition;
  }
}

// Apply to route
@UseGuards(CustomGuard)
@Get('special')
async specialEndpoint() { ... }
```

## Summary

✅ **Global Protection:** All routes protected by default
✅ **Multi-Tenancy:** Automatic organization scoping
✅ **RBAC:** Three-tier role system (ADMIN, MANAGER, OPERATOR)
✅ **Simple API:** Use decorators (@Public, @Roles, @CurrentUser)
✅ **Secure:** Bcrypt passwords, JWT tokens, role validation
✅ **Production-Ready:** Follows NestJS best practices

The authentication system is complete and ready for production use!
