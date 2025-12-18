import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAMES } from '@/lib/cookies';

/**
 * Global middleware for authentication
 *
 * Flow:
 * 1. Check if path is public (login, api, static assets)
 * 2. Check for access_token cookie
 * 3. If missing → redirect to /auth/login
 * 4. If present but selected_org missing → redirect to /select-org
 * 5. Otherwise allow request
 *
 * Note: This is a lightweight check using cookies only.
 * Server components should use getServerAccountContext() for authoritative checks.
 */

const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/api',
  '/_next',
  '/favicon.ico',
  '/static',
];

const AUTH_REQUIRED_PATHS = ['/select-org'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for access_token
  const accessToken = request.cookies.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  if (!accessToken) {
    // Not authenticated → redirect to login
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check for selected_org (skip for /select-org itself)
  if (!AUTH_REQUIRED_PATHS.includes(pathname)) {
    const selectedOrg = request.cookies.get(COOKIE_NAMES.SELECTED_ORG)?.value;

    if (!selectedOrg) {
      // No org selected → redirect to select-org
      const selectOrgUrl = new URL('/select-org', request.url);
      selectOrgUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(selectOrgUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
