import { NextRequest, NextResponse } from 'next/server';
import { createSelectedOrgCookie } from '@/lib/cookies';
import { cookies } from 'next/headers';
import { COOKIE_NAMES } from '@/lib/cookies';

/**
 * POST /api/account/switch-org
 *
 * Switches the selected organization by:
 * 1. Validating orgId is provided
 * 2. Optionally verifying user belongs to org (backend validation)
 * 3. Setting selected_org httpOnly cookie
 *
 * Body: { orgId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId required' },
        { status: 400 },
      );
    }

    // Optional: Verify user belongs to this org by calling backend
    // For now, we trust the client and validate on protected routes
    const cookieStore = cookies();
    const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // TODO: Call backend to verify orgId belongs to user
    // const backendUrl = process.env.BACKEND_URL;
    // const response = await fetch(`${backendUrl}/account/validate-org`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${accessToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ orgId }),
    // });
    // if (!response.ok) {
    //   return NextResponse.json(
    //     { error: 'Invalid organization' },
    //     { status: 403 },
    //   );
    // }

    // Set selected_org cookie
    const response = NextResponse.json({
      ok: true,
      selectedOrg: orgId,
    });

    response.headers.set('Set-Cookie', createSelectedOrgCookie(orgId));

    return response;
  } catch (error: any) {
    console.error('Switch org error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
