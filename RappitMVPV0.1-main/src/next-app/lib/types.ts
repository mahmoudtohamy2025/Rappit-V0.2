/**
 * Type definitions for auth and account context
 */

export interface User {
  id: string;
  name: string;
  email: string;
  accountId: string;
}

export interface Account {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  defaultOrgId?: string;
  features: string[];
}

export interface Organization {
  id: string;
  name: string;
  role: 'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_VIEWER' | 'ORG_READONLY';
}

export interface AccountContext {
  user: User;
  account: Account;
  organizations: Organization[];
  selectedOrg: Organization | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  user: User;
  account: Account;
  organizations: Organization[];
}

export interface AuthMeResponse {
  user: User;
  account: Account;
  organizations: Organization[];
}
