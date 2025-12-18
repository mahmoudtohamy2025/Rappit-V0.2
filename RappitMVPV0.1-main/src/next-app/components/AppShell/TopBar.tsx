'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Account, Organization, User } from '@/lib/types';
import { OrgSwitcher } from '@/components/OrgSwitcher/OrgSwitcher';
import { apiFetch } from '@/lib/fetcher';

interface TopBarProps {
  user: User;
  account: Account;
  organizations: Organization[];
  selectedOrg: Organization | null;
}

export function TopBar({
  user,
  account,
  organizations,
  selectedOrg,
}: TopBarProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'pro':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Right side - Logo and Org */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary-600">Rappit</h1>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${getPlanBadgeColor(account.plan)}`}
            >
              {account.plan.toUpperCase()}
            </span>
          </div>

          <div className="h-8 w-px bg-gray-300" />

          <OrgSwitcher
            organizations={organizations}
            selectedOrg={selectedOrg}
          />
        </div>

        {/* Left side - Notifications and User Menu */}
        <div className="flex items-center gap-4">
          {/* Notifications (placeholder) */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            {/* Notification badge */}
            <span className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                  {user.name}
                </div>
                <div className="text-xs text-gray-500">{account.name}</div>
              </div>
            </button>

            {isUserMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsUserMenuOpen(false)}
                />

                {/* Dropdown */}
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <div className="text-sm font-medium text-gray-700">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>

                  <button
                    onClick={() => router.push('/settings/profile')}
                    className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    الملف الشخصي
                  </button>

                  <button
                    onClick={() => router.push('/settings/billing')}
                    className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    الفوترة والخطة
                  </button>

                  <div className="border-t border-gray-200 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {isLoggingOut ? 'جاري تسجيل الخروج...' : 'تسجيل الخروج'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
