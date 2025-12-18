'use client';

import { useState } from 'react';
import type { Account } from '@/lib/types';
import { Button } from '@/components/UI/Button';
import { apiFetch } from '@/lib/fetcher';

interface BillingContentProps {
  account: Account;
}

export function BillingContent({ account }: BillingContentProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
    setIsLoading(true);

    try {
      // TODO: Call backend to get Stripe checkout URL
      const response = await apiFetch<{ url: string }>(
        '/api/billing/create-checkout',
        {
          method: 'POST',
          body: JSON.stringify({ plan }),
        },
      );

      // Redirect to Stripe checkout
      window.location.href = response.url;
    } catch (error: any) {
      console.error('Failed to upgrade:', error);
      alert(error.message || 'فشل الترقية. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);

    try {
      // TODO: Call backend to get Stripe billing portal URL
      const response = await apiFetch<{ url: string }>(
        '/api/billing/portal',
        {
          method: 'POST',
        },
      );

      // Redirect to Stripe billing portal
      window.location.href = response.url;
    } catch (error: any) {
      console.error('Failed to open billing portal:', error);
      alert(error.message || 'فشل فتح بوابة الفوترة. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <PlanCard
          name="Free"
          price="$0"
          features={[
            'حتى 100 طلب/شهر',
            'قناة واحدة',
            'دعم عبر البريد',
          ]}
          isCurrent={account.plan === 'free'}
          onSelect={() => {}}
          disabled={account.plan === 'free'}
          buttonText="الخطة الحالية"
        />

        {/* Pro Plan */}
        <PlanCard
          name="Pro"
          price="$49"
          period="/شهر"
          features={[
            'طلبات غير محدودة',
            'قنوات غير محدودة',
            'شحن متقدم (DHL/FedEx)',
            'إدارة الفريق',
            'تحليلات متقدمة',
            'دعم ذو أولوية',
          ]}
          isCurrent={account.plan === 'pro'}
          onSelect={() => handleUpgrade('pro')}
          disabled={account.plan === 'pro' || isLoading}
          buttonText={account.plan === 'pro' ? 'الخطة الحالية' : 'ترقية إلى Pro'}
          highlighted
        />

        {/* Enterprise Plan */}
        <PlanCard
          name="Enterprise"
          price="مخصص"
          features={[
            'كل ميزات Pro',
            'مدير حساب مخصص',
            'SLA مضمون',
            'تكامل مخصص',
            'تدريب مخصص',
            'دعم 24/7',
          ]}
          isCurrent={account.plan === 'enterprise'}
          onSelect={() => handleUpgrade('enterprise')}
          disabled={account.plan === 'enterprise' || isLoading}
          buttonText={
            account.plan === 'enterprise' ? 'الخطة الحالية' : 'اتصل بنا'
          }
        />
      </div>

      {/* Billing Management */}
      {account.plan !== 'free' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            إدارة الفوترة
          </h2>
          <p className="text-gray-600 mb-4">
            إدارة معلومات الدفع، عرض الفواتير، أو إلغاء الاشتراك.
          </p>
          <Button
            onClick={handleManageBilling}
            isLoading={isLoading}
            variant="outline"
          >
            فتح بوابة الفوترة
          </Button>
        </div>
      )}

      {/* TODO Disclaimer */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>ملاحظة:</strong> هذه صفحة تجريبية. لم يتم تفعيل التكامل مع Stripe بعد.
          سيتم توجيهك إلى بوابة الدفع عند تفعيل التكامل.
        </p>
      </div>
    </div>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  features: string[];
  isCurrent: boolean;
  onSelect: () => void;
  disabled: boolean;
  buttonText: string;
  highlighted?: boolean;
}

function PlanCard({
  name,
  price,
  period,
  features,
  isCurrent,
  onSelect,
  disabled,
  buttonText,
  highlighted,
}: PlanCardProps) {
  return (
    <div
      className={`
        bg-white rounded-lg shadow p-6 flex flex-col
        ${highlighted ? 'ring-2 ring-primary-500 relative' : ''}
      `}
    >
      {highlighted && (
        <div className="absolute -top-3 right-1/2 translate-x-1/2 px-4 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">
          الأكثر شعبية
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{name}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900">{price}</span>
          {period && <span className="text-gray-600">{period}</span>}
        </div>
      </div>

      <ul className="space-y-3 mb-6 flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <Button
        onClick={onSelect}
        disabled={disabled}
        variant={isCurrent ? 'outline' : highlighted ? 'primary' : 'secondary'}
        className="w-full"
      >
        {buttonText}
      </Button>
    </div>
  );
}
