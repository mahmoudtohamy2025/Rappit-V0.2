# 🚀 Rappit Frontend - Next.js App Router with Auth & Multi-Tenancy

Complete Next.js 14+ frontend with TypeScript, Tailwind CSS, RTL support, and secure authentication.

---

## 📋 **Project Overview**

This is a production-ready Next.js frontend that implements:

- ✅ **Server-mediated authentication** (httpOnly JWT cookies)
- ✅ **Multi-tenant architecture** (Account + Organizations)
- ✅ **RTL UI** with Arabic-first design
- ✅ **Server-side route protection** (middleware + server components)
- ✅ **Organization selection** with server-side cookie management
- ✅ **Feature gating** based on account plan
- ✅ **Secure cookie handling** (httpOnly, Secure, SameSite)

---

## 🏗️ **Architecture**

### **Auth Flow**

```
1. User visits / → No access_token → Redirect to /auth/login
2. User submits credentials → POST /api/auth/login
3. API route calls backend → Backend returns JWT + user/account data
4. API route sets httpOnly access_token cookie
5. If single org → Auto-set selected_org cookie → Redirect to /
6. If multiple orgs → Redirect to /select-org
7. User selects org → POST /api/account/switch-org → Sets selected_org cookie
8. Dashboard loads with TopBar + RightSideNav
```

### **Multi-Tenancy Model**

- **Account**: Billing entity (plan, features, status)
- **Organizations**: Tenants (user can belong to multiple orgs with different roles)
- **Selected Org**: Current working context (stored in httpOnly cookie)

### **Cookie Strategy**

| Cookie | Purpose | HttpOnly | Secure | MaxAge |
|--------|---------|----------|--------|--------|
| `access_token` | JWT authentication | ✅ | ✅ (prod) | Backend `expiresIn` |
| `selected_org` | Current organization | ✅ | ✅ (prod) | 30 days |
| `refresh_token` | Token refresh (future) | ✅ | ✅ (prod) | 7 days |

---

## 🚀 **Getting Started**

### **Prerequisites**

- Node.js 18+
- npm or yarn
- Running backend API (see backend README)

### **Installation**

```bash
# Clone repository
git clone <repo-url>
cd next-app

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local

# Edit .env.local and set BACKEND_URL
nano .env.local
```

### **Environment Configuration**

Create `.env.local`:

```bash
# Backend API URL
BACKEND_URL=http://localhost:3001

# Node environment
NODE_ENV=development

# Next.js public URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cookie settings
COOKIE_SECURE=false
```

### **Run Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🧪 **Testing the Flow**

### **1. Login Flow**

1. Navigate to `http://localhost:3000`
2. You'll be redirected to `/auth/login` (no cookie)
3. Enter credentials:
   - Email: `admin@example.com`
   - Password: `password123`
4. Click "تسجيل الدخول"

**Expected Result:**
- POST request to `/api/auth/login`
- Response sets `Set-Cookie: access_token=...`
- Redirect to `/select-org` (if multiple orgs) or `/` (if single org)

### **2. Organization Selection**

If multiple organizations:

1. `/select-org` page shows list of organizations
2. Select an organization
3. Click "متابعة"
4. POST request to `/api/account/switch-org`
5. Response sets `Set-Cookie: selected_org=...`
6. Redirect to dashboard

### **3. Dashboard**

After successful login:

1. Dashboard (`/`) loads with:
   - TopBar: Account name, plan badge, OrgSwitcher, notifications, user menu
   - RightSideNav: Navigation items on the right (RTL)
   - Main content area with stats and activity

2. Features:
   - **Organization Switching**: Click org name in TopBar → Dropdown → Select org
   - **Feature Gating**: Pro features show "PRO" badge, clicking prompts upgrade
   - **User Menu**: Click avatar → Profile, Billing, Logout
   - **Logout**: Clears all cookies → Redirect to login

### **4. Protected Routes**

Try visiting protected routes without cookies:

```bash
# Clear cookies in browser DevTools
# Visit http://localhost:3000/orders

# Expected: Redirect to /auth/login?redirect=/orders
```

---

## 📁 **Project Structure**

```
next-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                  # Auth routes (public)
│   │   └── login/page.tsx       # Login page
│   ├── api/                     # API routes
│   │   ├── auth/
│   │   │   ├── login/route.ts   # POST /api/auth/login
│   │   │   └── logout/route.ts  # POST /api/auth/logout
│   │   └── account/
│   │       └── switch-org/route.ts  # POST /api/account/switch-org
│   ├── select-org/              # Organization selection
│   │   ├── page.tsx             # Server page
│   │   └── OrgSelector.tsx      # Client component
│   ├── layout.tsx               # Root layout (TopBar + RightSideNav)
│   ├── page.tsx                 # Dashboard (protected)
│   └── globals.css              # Tailwind CSS
│
├── components/
│   ├── AppShell/
│   │   ├── TopBar.tsx           # Top navigation bar
│   │   └── RightSideNav.tsx     # Right sidebar navigation (RTL)
│   ├── Auth/
│   │   └── LoginForm.tsx        # Login form (client)
│   ├── OrgSwitcher/
│   │   └── OrgSwitcher.tsx      # Organization switcher dropdown
│   └── UI/
│       ├── Button.tsx           # Reusable button
│       └── Input.tsx            # Reusable input
│
├── lib/
│   ├── auth/
│   │   └── getServerAccountContext.ts  # Server helper to get auth context
│   ├── cookies.ts               # Cookie utilities
│   ├── fetcher.ts               # Type-safe fetch wrapper
│   └── types.ts                 # TypeScript types
│
├── middleware.ts                # Global middleware (auth check)
│
├── tests/
│   └── integration/             # Integration tests
│
├── .env.local.example           # Environment template
├── next.config.js               # Next.js config
├── tailwind.config.js           # Tailwind CSS config (RTL support)
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies
```

---

## 🔐 **Security Features**

### **Cookie Security**

✅ **HttpOnly**: Cookies not accessible via JavaScript (XSS protection)
✅ **Secure**: HTTPS-only in production
✅ **SameSite**: `lax` to prevent CSRF
✅ **Path**: `/` for app-wide access
✅ **MaxAge**: Automatic expiry based on backend `expiresIn`

### **Server-Side Protection**

✅ **Middleware**: Checks cookie existence, redirects if missing
✅ **Server Components**: Use `getServerAccountContext()` for authoritative data
✅ **API Routes**: Validate cookies before backend calls
✅ **No Client-Side Tokens**: Never store tokens in localStorage/sessionStorage

### **Backend Validation**

✅ Backend is source of truth for all auth/org data
✅ Frontend calls `GET /auth/me` on every page load (server-side)
✅ `selected_org` validated on protected routes

---

## 🎨 **RTL Support**

### **Tailwind RTL**

Using `tailwindcss-rtl` plugin for automatic RTL support:

```tsx
// Auto-converts margin-left → margin-right in RTL
<div className="ml-4">  // Becomes mr-4 in RTL

// Use directional utilities
<div className="ms-4">  // margin-inline-start (works in both LTR/RTL)
<div className="me-4">  // margin-inline-end
```

### **Layout**

- `<html lang="ar" dir="rtl">` in root layout
- Navigation on the right side (RightSideNav)
- Text alignment: right-to-left
- Icon placement: reversed for RTL context

---

## 🧪 **Testing**

### **Run Tests**

```bash
npm test
```

### **Integration Tests**

**Test 1: Login Cookie Set**
```bash
npm test -- tests/integration/api.auth.login.spec.ts
```

**Test 2: Middleware Redirect**
```bash
npm test -- tests/integration/middleware.spec.ts
```

### **Manual Testing Checklist**

- [ ] Login with valid credentials → Cookie set → Redirect
- [ ] Login with invalid credentials → Error message
- [ ] Visit `/` without cookie → Redirect to `/auth/login`
- [ ] Visit `/` with `access_token` but no `selected_org` → Redirect to `/select-org`
- [ ] Select org → Cookie set → Redirect to dashboard
- [ ] Switch org → Page refreshes with new context
- [ ] Logout → Cookies cleared → Redirect to login
- [ ] Feature gating → Click disabled nav → Upgrade prompt

---

## 📦 **Backend Contract**

The frontend expects the following backend endpoints:

### **POST /auth/login**

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGci...",
  "expiresIn": 3600,
  "refreshToken": "optional",
  "user": {
    "id": "user_123",
    "name": "Ahmed Ali",
    "email": "admin@example.com",
    "accountId": "acct_1"
  },
  "account": {
    "id": "acct_1",
    "name": "Acme Corp",
    "plan": "pro",
    "status": "ACTIVE",
    "defaultOrgId": "org_1",
    "features": ["shipping", "team"]
  },
  "organizations": [
    {
      "id": "org_1",
      "name": "Acme Main",
      "role": "ORG_ADMIN"
    },
    {
      "id": "org_2",
      "name": "Acme EU",
      "role": "ORG_MEMBER"
    }
  ]
}
```

### **GET /auth/me**

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** Same as login response (user, account, organizations)

---

## 🚧 **TODOs & Production Upgrades**

### **High Priority**

- [ ] Implement refresh token flow (`POST /api/auth/refresh`)
- [ ] Add backend validation for `switch-org` (verify user belongs to org)
- [ ] Implement session revocation (backend logout)
- [ ] Add cookie rotation on sensitive operations

### **Medium Priority**

- [ ] Implement `/settings/billing` page with Stripe integration
- [ ] Add role-based UI (show/hide features based on org role)
- [ ] Implement SSO/SAML for enterprise accounts
- [ ] Add 2FA support

### **Nice to Have**

- [ ] Remember last selected org (even after logout)
- [ ] Org switcher keyboard shortcuts
- [ ] Loading states for slow backend responses
- [ ] Offline detection and retry logic

---

## 🐛 **Troubleshooting**

### **Issue: Login fails with "BACKEND_URL not configured"**

**Solution:**
```bash
# Check .env.local exists and has BACKEND_URL
cat .env.local

# Should contain:
BACKEND_URL=http://localhost:3001
```

### **Issue: Redirect loop (keeps redirecting to /auth/login)**

**Cause:** Backend `/auth/me` is failing or returning 401

**Solution:**
1. Check backend is running: `curl http://localhost:3001/health`
2. Check cookie is set: DevTools → Application → Cookies
3. Test backend endpoint:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:3001/auth/me
   ```

### **Issue: "Cookies not set" after login**

**Cause:** Cookie `secure` flag enabled on localhost

**Solution:**
```bash
# In .env.local
COOKIE_SECURE=false

# Or use HTTPS on localhost
```

### **Issue: Middleware not protecting routes**

**Cause:** Public path incorrectly configured

**Solution:**
Check `middleware.ts` → `PUBLIC_PATHS` array includes your route

---

## 📚 **Additional Resources**

- **Next.js App Router**: https://nextjs.org/docs/app
- **Tailwind CSS RTL**: https://github.com/20lives/tailwindcss-rtl
- **Cookie Security**: https://owasp.org/www-community/controls/SecureCookieAttribute
- **Multi-Tenancy**: https://www.netlify.com/blog/multi-tenancy/

---

## 👥 **Support**

For issues or questions:
1. Check this README
2. Review browser DevTools (Network, Application tabs)
3. Check backend logs
4. Contact: frontend-team@rappit.com

---

**Last Updated:** December 15, 2024
**Version:** 1.0.0
**Maintainer:** Rappit Frontend Team
