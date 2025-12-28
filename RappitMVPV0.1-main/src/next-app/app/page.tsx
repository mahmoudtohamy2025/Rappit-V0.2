import { redirect } from 'next/navigation';
import { getServerAccountContext } from '@/lib/auth/getServerAccountContext';

/**
 * Dashboard Page (Protected)
 *
 * Server component that requires authentication
 */
export default async function DashboardPage() {
  const context = await getServerAccountContext();

  if (!context) {
    redirect('/auth/login');
  }

  const { user, account, selectedOrg } = context;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            مرحباً، {user.name}!
          </h1>
          <p className="text-gray-600">
            المؤسسة الحالية: <span className="font-medium">{selectedOrg?.name}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="إجمالي الطلبات"
            value="1,234"
            change="+12%"
            positive
          />
          <StatCard
            title="المنتجات"
            value="567"
            change="+5%"
            positive
          />
          <StatCard
            title="الشحنات النشطة"
            value="89"
            change="-3%"
            positive={false}
          />
          <StatCard
            title="الإيرادات"
            value="$45,678"
            change="+23%"
            positive
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            النشاط الأخير
          </h2>
          <div className="space-y-4">
            <ActivityItem
              type="order"
              message="طلب جديد #ORD-1234"
              time="منذ 5 دقائق"
            />
            <ActivityItem
              type="shipment"
              message="تم شحن الطلب #ORD-1230"
              time="منذ 15 دقيقة"
            />
            <ActivityItem
              type="product"
              message="تم إضافة منتج جديد: قميص قطني"
              time="منذ ساعة"
            />
          </div>
        </div>

        {/* Account Info (Debug) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Debug Info
            </h3>
            <pre className="text-xs text-gray-600 overflow-auto">
              {JSON.stringify(
                {
                  user: { id: user.id, email: user.email },
                  account: {
                    id: account.id,
                    name: account.name,
                    plan: account.plan,
                    status: account.status,
                    features: account.features,
                  },
                  selectedOrg: selectedOrg
                    ? { id: selectedOrg.id, name: selectedOrg.name, role: selectedOrg.role }
                    : null,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  positive,
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
      <p
        className={`text-sm ${
          positive ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {change}
      </p>
    </div>
  );
}

function ActivityItem({
  type,
  message,
  time,
}: {
  type: 'order' | 'shipment' | 'product';
  message: string;
  time: string;
}) {
  const icons = {
    order: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    shipment: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    product: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
        {icons[type]}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-900">{message}</p>
        <p className="text-xs text-gray-500 mt-1">{time}</p>
      </div>
    </div>
  );
}
