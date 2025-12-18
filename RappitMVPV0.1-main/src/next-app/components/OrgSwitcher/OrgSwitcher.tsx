'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Organization } from '@/lib/types';
import { apiFetch } from '@/lib/fetcher';

interface OrgSwitcherProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
}

export function OrgSwitcher({ organizations, selectedOrg }: OrgSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSwitchOrg = async (orgId: string) => {
    if (orgId === selectedOrg?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/api/account/switch-org', {
        method: 'POST',
        body: JSON.stringify({ orgId }),
      });

      // Success - refresh page to reload context
      setIsOpen(false);
      router.refresh();
    } catch (error: any) {
      console.error('Failed to switch org:', error);
      alert(error.message || 'فشل تبديل المؤسسة');
    } finally {
      setIsLoading(false);
    }
  };

  if (organizations.length <= 1) {
    return (
      <div className="px-3 py-2 text-sm text-gray-700">
        {selectedOrg?.name || 'لا توجد مؤسسة'}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        disabled={isLoading}
      >
        <span>{selectedOrg?.name || 'اختر مؤسسة'}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitchOrg(org.id)}
                className={`
                  w-full text-right px-4 py-2 text-sm hover:bg-gray-50 transition-colors
                  ${org.id === selectedOrg?.id ? 'bg-primary-50 text-primary-700' : 'text-gray-700'}
                `}
                disabled={isLoading}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-gray-500">{org.role}</div>
                  </div>
                  {org.id === selectedOrg?.id && (
                    <svg
                      className="w-5 h-5 text-primary-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
