import { NextResponse } from 'next/server';
import { clearCookie, COOKIE_NAMES } from '@/lib/cookies';

/**
 * POST /api/auth/logout
 *
 * Clears authentication cookies:
 * - access_token
 * - selected_org
 * - refresh_token (if present)
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear all auth cookies
  response.headers.append('Set-Cookie', clearCookie(COOKIE_NAMES.ACCESS_TOKEN));
  response.headers.append('Set-Cookie', clearCookie(COOKIE_NAMES.SELECTED_ORG));
  response.headers.append('Set-Cookie', clearCookie(COOKIE_NAMES.REFRESH_TOKEN));

  return response;
}
