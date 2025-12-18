import { cookies } from 'next/headers';
import { COOKIE_NAMES } from '@/lib/cookies';
import type { AccountContext, AuthMeResponse } from '@/lib/types';

/**
 * Server-side helper to get account context
 *
 * This function:
 * 1. Reads access_token from httpOnly cookie
 * 2. Calls backend /auth/me with Bearer token
 * 3. Reads selected_org cookie
 * 4. Resolves selectedOrg object
 *
 * Returns null if not authenticated
 */
export async function getServerAccountContext(): Promise<AccountContext | null> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    // Call backend /auth/me with token
    const response = await fetch(`${process.env.BACKEND_URL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Important: always fetch fresh data
    });

    if (!response.ok) {
      console.error('Failed to fetch account context:', response.status);
      return null;
    }

    const data: AuthMeResponse = await response.json();

    // Get selected org from cookie
    const selectedOrgId = cookieStore.get(COOKIE_NAMES.SELECTED_ORG)?.value;

    // Resolve selectedOrg
    let selectedOrg = null;

    if (selectedOrgId) {
      // Try to find org by ID
      selectedOrg =
        data.organizations.find((org) => org.id === selectedOrgId) || null;
    }

    // Fallback to defaultOrgId or first org
    if (!selectedOrg) {
      if (data.account.defaultOrgId) {
        selectedOrg =
          data.organizations.find(
            (org) => org.id === data.account.defaultOrgId,
          ) || null;
      }

      if (!selectedOrg && data.organizations.length > 0) {
        selectedOrg = data.organizations[0];
      }
    }

    return {
      user: data.user,
      account: data.account,
      organizations: data.organizations,
      selectedOrg,
    };
  } catch (error) {
    console.error('Error fetching account context:', error);
    return null;
  }
}

/**
 * Require authenticated context (throw if not authenticated)
 */
export async function requireServerAccountContext(): Promise<AccountContext> {
  const context = await getServerAccountContext();

  if (!context) {
    throw new Error('Unauthorized');
  }

  return context;
}
