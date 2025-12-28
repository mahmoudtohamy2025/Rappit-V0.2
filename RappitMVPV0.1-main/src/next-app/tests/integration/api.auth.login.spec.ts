/**
 * Integration Tests: Login API
 *
 * Tests that login endpoint:
 * 1. Sets httpOnly access_token cookie
 * 2. Returns user/account/organizations data
 * 3. Auto-sets selected_org for single org accounts
 */

import { POST } from '@/app/api/auth/login/route';
import nock from 'nock';

// Mock Next.js Request
class MockNextRequest {
  private body: any;

  constructor(body: any) {
    this.body = body;
  }

  async json() {
    return this.body;
  }
}

describe('POST /api/auth/login', () => {
  const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should set httpOnly access_token cookie on successful login', async () => {
    // Arrange - Mock backend response
    const mockLoginResponse = {
      accessToken: 'test-jwt-token-123',
      expiresIn: 3600,
      user: {
        id: 'user_1',
        name: 'Ahmed Ali',
        email: 'admin@example.com',
        accountId: 'acct_1',
      },
      account: {
        id: 'acct_1',
        name: 'Acme Corp',
        plan: 'pro',
        status: 'ACTIVE',
        defaultOrgId: 'org_1',
        features: ['shipping', 'team'],
      },
      organizations: [
        {
          id: 'org_1',
          name: 'Acme Main',
          role: 'ORG_ADMIN',
        },
      ],
    };

    nock(BACKEND_URL)
      .post('/auth/login', {
        email: 'admin@example.com',
        password: 'password123',
      })
      .reply(200, mockLoginResponse);

    // Act
    const request = new MockNextRequest({
      email: 'admin@example.com',
      password: 'password123',
    });

    const response = await POST(request as any);
    const data = await response.json();
    const cookies = response.headers.getSetCookie();

    // Assert - Response data
    expect(data.user).toEqual(mockLoginResponse.user);
    expect(data.account).toEqual(mockLoginResponse.account);
    expect(data.organizations).toEqual(mockLoginResponse.organizations);

    // Assert - access_token cookie set
    const accessTokenCookie = cookies.find((c) =>
      c.startsWith('access_token='),
    );
    expect(accessTokenCookie).toBeDefined();
    expect(accessTokenCookie).toContain('test-jwt-token-123');
    expect(accessTokenCookie).toContain('HttpOnly');
    expect(accessTokenCookie).toContain('Path=/');
    expect(accessTokenCookie).toContain('Max-Age=3600');

    // Assert - selected_org cookie set (single org auto-selection)
    const selectedOrgCookie = cookies.find((c) =>
      c.startsWith('selected_org='),
    );
    expect(selectedOrgCookie).toBeDefined();
    expect(selectedOrgCookie).toContain('org_1');
  });

  it('should NOT auto-set selected_org for multi-org accounts', async () => {
    // Arrange - Multiple organizations
    const mockLoginResponse = {
      accessToken: 'test-jwt-token-456',
      expiresIn: 3600,
      user: {
        id: 'user_2',
        name: 'Sarah Ahmed',
        email: 'sarah@example.com',
        accountId: 'acct_2',
      },
      account: {
        id: 'acct_2',
        name: 'Multi Corp',
        plan: 'enterprise',
        status: 'ACTIVE',
        features: ['shipping', 'team'],
      },
      organizations: [
        { id: 'org_1', name: 'Org One', role: 'ORG_ADMIN' },
        { id: 'org_2', name: 'Org Two', role: 'ORG_MEMBER' },
      ],
    };

    nock(BACKEND_URL)
      .post('/auth/login')
      .reply(200, mockLoginResponse);

    // Act
    const request = new MockNextRequest({
      email: 'sarah@example.com',
      password: 'password123',
    });

    const response = await POST(request as any);
    const cookies = response.headers.getSetCookie();

    // Assert - access_token set
    const accessTokenCookie = cookies.find((c) =>
      c.startsWith('access_token='),
    );
    expect(accessTokenCookie).toBeDefined();

    // Assert - selected_org NOT set (user must choose)
    const selectedOrgCookie = cookies.find((c) =>
      c.startsWith('selected_org='),
    );
    expect(selectedOrgCookie).toBeUndefined();
  });

  it('should return error when credentials are invalid', async () => {
    // Arrange - Backend returns 401
    nock(BACKEND_URL)
      .post('/auth/login')
      .reply(401, { error: 'Invalid credentials' });

    // Act
    const request = new MockNextRequest({
      email: 'wrong@example.com',
      password: 'wrongpassword',
    });

    const response = await POST(request as any);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('should return 400 when email or password is missing', async () => {
    // Act
    const request = new MockNextRequest({
      email: 'test@example.com',
      // password missing
    });

    const response = await POST(request as any);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password required');
  });

  it('should use default maxAge when expiresIn not provided', async () => {
    // Arrange
    const mockLoginResponse = {
      accessToken: 'test-token',
      // expiresIn missing
      user: { id: 'user_1', name: 'Test', email: 'test@example.com', accountId: 'acct_1' },
      account: {
        id: 'acct_1',
        name: 'Test Corp',
        plan: 'free',
        status: 'ACTIVE',
        features: [],
      },
      organizations: [{ id: 'org_1', name: 'Org', role: 'ORG_ADMIN' }],
    };

    nock(BACKEND_URL)
      .post('/auth/login')
      .reply(200, mockLoginResponse);

    // Act
    const request = new MockNextRequest({
      email: 'test@example.com',
      password: 'password',
    });

    const response = await POST(request as any);
    const cookies = response.headers.getSetCookie();

    // Assert - Should use fallback 3600 seconds
    const accessTokenCookie = cookies.find((c) =>
      c.startsWith('access_token='),
    );
    expect(accessTokenCookie).toContain('Max-Age=3600');
  });
});
