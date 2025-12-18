import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthCookie,
  createSelectedOrgCookie,
  COOKIE_NAMES,
} from '@/lib/cookies';
import type { LoginResponse } from '@/lib/types';

/**
 * POST /api/auth/login
 *
 * Handles login by:
 * 1. Forwarding credentials to backend
 * 2. Setting httpOnly access_token cookie
 * 3. Auto-setting selected_org if single org
 * 4. Returning user/account/organizations to client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 },
      );
    }

    // Call backend login
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      throw new Error('BACKEND_URL not configured');
    }

    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Login failed' },
        { status: response.status },
      );
    }

    const { accessToken, expiresIn, user, account, organizations } = data;

    // Create response
    const result = NextResponse.json({
      user,
      account,
      organizations,
    });

    // Set access_token cookie
    result.headers.append(
      'Set-Cookie',
      createAuthCookie(accessToken, expiresIn || 3600),
    );

    // Auto-set selected_org if single organization
    if (organizations.length === 1) {
      result.headers.append(
        'Set-Cookie',
        createSelectedOrgCookie(organizations[0].id),
      );
    } else if (account.defaultOrgId) {
      // Or use account default
      result.headers.append(
        'Set-Cookie',
        createSelectedOrgCookie(account.defaultOrgId),
      );
    }

    return result;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
