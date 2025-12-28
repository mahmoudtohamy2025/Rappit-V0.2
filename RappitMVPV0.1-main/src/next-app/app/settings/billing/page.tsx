import { redirect } from 'next/navigation';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';
import { BillingContent } from './BillingContent';

/**
 * Billing & Subscription Page
 *
 * Shows account plan, usage, and upgrade options
 */
export default async function BillingPage() {
  const context = await getServerAccountContext();

  if (!context) {
    redirect('/auth/login');
  }

  const { account, user } = context;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            الفوترة والاشتراك
          </h1>
          <p className="text-gray-600">
            إدارة خطتك والدفع
          </p>
        </div>

        {/* Current Plan */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                الخطة الحالية
              </h2>
              <p className="text-gray-600">
                {account.name}
              </p>
            </div>
            <div className="px-4 py-2 bg-primary-100 text-primary-800 font-semibold rounded-lg">
              {account.plan.toUpperCase()}
            </div>
          </div>

          {/* Plan Status */}
          {account.status === 'PAST_DUE' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ حسابك متأخر في الدفع. يرجى تحديث معلومات الدفع.
              </p>
            </div>
          )}

          {account.status === 'CANCELLED' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <p className="text-sm text-red-800 font-medium">
                ❌ تم إلغاء اشتراكك. قم بالترقية لاستعادة الوصول.
              </p>
            </div>
          )}

          {/* Features */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              الميزات المفعلة:
            </h3>
            <div className="flex flex-wrap gap-2">
              {account.features.map((feature) => (
                <span
                  key={feature}
                  className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
                >
                  ✓ {getFeatureLabel(feature)}
                </span>
              ))}
              {account.features.length === 0 && (
                <span className="text-sm text-gray-500">
                  لا توجد ميزات إضافية
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Billing Content (Client Component) */}
        <BillingContent account={account} />
      </div>
    </div>
  );
}

function getFeatureLabel(feature: string): string {
  const labels: Record<string, string> = {
    shipping: 'الشحن المتقدم',
    team: 'إدارة الفريق',
    api: 'واجهة برمجية',
    analytics: 'التحليلات المتقدمة',
    support: 'الدعم الممتاز',
  };
  return labels[feature] || feature;
}
