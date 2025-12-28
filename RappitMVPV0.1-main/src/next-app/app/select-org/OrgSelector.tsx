'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Organization } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { apiFetch } from '@/lib/fetcher';

interface OrgSelectorProps {
  organizations: Organization[];
  redirectTo: string;
}

export function OrgSelector({ organizations, redirectTo }: OrgSelectorProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedId) {
      alert('الرجاء اختيار مؤسسة');
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/api/account/switch-org', {
        method: 'POST',
        body: JSON.stringify({ orgId: selectedId }),
      });

      // Success - redirect
      router.push(redirectTo);
    } catch (error: any) {
      console.error('Failed to select org:', error);
      alert(error.message || 'فشل اختيار المؤسسة');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Organization Cards */}
      <div className="grid gap-4">
        {organizations.map((org) => (
          <button
            key={org.id}
            onClick={() => setSelectedId(org.id)}
            className={`
              text-right p-6 rounded-lg border-2 transition-all
              ${
                selectedId === org.id
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {org.name}
                </h3>
                <p className="text-sm text-gray-600">
                  الدور: {getRoleLabel(org.role)}
                </p>
              </div>

              {selectedId === org.id && (
                <div className="p-2 bg-primary-600 rounded-full">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Continue Button */}
      <Button
        onClick={handleContinue}
        disabled={!selectedId || isLoading}
        isLoading={isLoading}
        className="w-full"
        size="lg"
      >
        {isLoading ? 'جاري المتابعة...' : 'متابعة'}
      </Button>
    </div>
  );
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ORG_ADMIN: 'مدير',
    ORG_MEMBER: 'عضو',
    ORG_VIEWER: 'مشاهد',
    ORG_READONLY: 'للقراءة فقط',
  };
  return labels[role] || role;
}
