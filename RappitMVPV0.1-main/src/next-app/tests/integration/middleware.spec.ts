/**
 * Integration Tests: Middleware
 *
 * Tests that middleware correctly:
 * 1. Redirects unauthenticated users to /auth/login
 * 2. Redirects users without selected_org to /select-org
 * 3. Allows public paths without redirect
 */

import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';

// Mock NextRequest
function createMockRequest(
  pathname: string,
  cookies: Record<string, string> = {},
): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const request = new NextRequest(url);

  // Mock cookies
  const cookieStore = new Map(Object.entries(cookies));
  (request as any).cookies = {
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    getAll: () => Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value })),
    has: (name: string) => cookieStore.has(name),
  };

  return request;
}

describe('Middleware Authentication', () => {
  describe('Unauthenticated users', () => {
    it('should redirect to /auth/login when accessing protected route without access_token', () => {
      // Arrange
      const request = createMockRequest('/orders');

      // Act
      const response = middleware(request);

      // Assert
      expect(response instanceof NextResponse).toBe(true);

      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeTruthy();
        expect(location).toContain('/auth/login');
        expect(location).toContain('redirect=%2Forders');
      }
    });

    it('should redirect to /auth/login when accessing root without access_token', () => {
      // Arrange
      const request = createMockRequest('/');

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toContain('/auth/login');
      }
    });

    it('should allow access to /auth/login without redirect', () => {
      // Arrange
      const request = createMockRequest('/auth/login');

      // Act
      const response = middleware(request);

      // Assert
      // Should return next() which allows the request
      expect(response).toBeTruthy();

      // Check if it's a redirect
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull(); // No redirect
      }
    });

    it('should allow access to API routes without redirect', () => {
      // Arrange
      const request = createMockRequest('/api/auth/login');

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull();
      }
    });

    it('should allow access to static assets without redirect', () => {
      // Arrange
      const request = createMockRequest('/_next/static/chunks/main.js');

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull();
      }
    });
  });

  describe('Authenticated users without selected_org', () => {
    it('should redirect to /select-org when access_token exists but selected_org missing', () => {
      // Arrange
      const request = createMockRequest('/', {
        access_token: 'valid-jwt-token',
      });

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeTruthy();
        expect(location).toContain('/select-org');
        expect(location).toContain('redirect=%2F');
      }
    });

    it('should redirect to /select-org when accessing orders without selected_org', () => {
      // Arrange
      const request = createMockRequest('/orders', {
        access_token: 'valid-jwt-token',
      });

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toContain('/select-org');
        expect(location).toContain('redirect=%2Forders');
      }
    });

    it('should NOT redirect /select-org itself (avoid infinite loop)', () => {
      // Arrange
      const request = createMockRequest('/select-org', {
        access_token: 'valid-jwt-token',
        // selected_org missing
      });

      // Act
      const response = middleware(request);

      // Assert
      // Should allow access to /select-org even without selected_org
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull(); // No redirect
      }
    });
  });

  describe('Fully authenticated users', () => {
    it('should allow access to protected routes when both cookies present', () => {
      // Arrange
      const request = createMockRequest('/orders', {
        access_token: 'valid-jwt-token',
        selected_org: 'org_1',
      });

      // Act
      const response = middleware(request);

      // Assert
      // Should return next() which allows the request
      expect(response).toBeTruthy();

      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull(); // No redirect
      }
    });

    it('should allow access to root when authenticated', () => {
      // Arrange
      const request = createMockRequest('/', {
        access_token: 'valid-jwt-token',
        selected_org: 'org_1',
      });

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull();
      }
    });

    it('should allow access to nested routes', () => {
      // Arrange
      const request = createMockRequest('/settings/billing', {
        access_token: 'valid-jwt-token',
        selected_org: 'org_1',
      });

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull();
      }
    });
  });

  describe('Edge cases', () => {
    it('should preserve redirect parameter in URL', () => {
      // Arrange
      const request = createMockRequest('/orders?status=pending');

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toContain('redirect=%2Forders');
      }
    });

    it('should handle favicon.ico without authentication', () => {
      // Arrange
      const request = createMockRequest('/favicon.ico');

      // Act
      const response = middleware(request);

      // Assert
      if (response instanceof NextResponse) {
        const location = response.headers.get('location');
        expect(location).toBeNull();
      }
    });
  });
});
