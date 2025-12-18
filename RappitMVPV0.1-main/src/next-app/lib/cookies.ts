import { serialize, parse, CookieSerializeOptions } from 'cookie';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  SELECTED_ORG: 'selected_org',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const DEFAULT_COOKIE_OPTIONS: CookieSerializeOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

/**
 * Create auth cookie with proper security settings
 */
export function createAuthCookie(
  token: string,
  expiresIn: number = 3600,
): string {
  return serialize(COOKIE_NAMES.ACCESS_TOKEN, token, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: expiresIn,
  });
}

/**
 * Create selected org cookie
 */
export function createSelectedOrgCookie(orgId: string): string {
  return serialize(COOKIE_NAMES.SELECTED_ORG, orgId, {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

/**
 * Create cookie to clear it (maxAge: 0)
 */
export function clearCookie(name: string): string {
  return serialize(name, '', {
    ...DEFAULT_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

/**
 * Parse cookies from header string
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return parse(cookieHeader);
}
