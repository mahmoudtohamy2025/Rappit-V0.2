import { Package, TrendingUp, AlertCircle, CheckCircle, DollarSign, Clock } from 'lucide-react';

export function Dashboard() {
  const stats = [
    { label: 'طلبات جديدة', value: '24', icon: Package, color: 'blue', change: '+12%' },
    { label: 'قيد التنفيذ', value: '156', icon: Clock, color: 'yellow', change: '+5%' },
    { label: 'تم التسليم اليوم', value: '89', icon: CheckCircle, color: 'green', change: '+23%' },
    { label: 'تحتاج انتباه', value: '7', icon: AlertCircle, color: 'red', change: '-3%' },
    { label: 'إجمالي المبيعات', value: '145,500 ر.س', icon: DollarSign, color: 'purple', change: '+18%' },
    { label: 'متوسط التسليم', value: '2.3 يوم', icon: TrendingUp, color: 'indigo', change: '-0.5 يوم' },
  ];

  const recentOrders = [
    { id: '#ORD-1234', customer: 'محمد أحمد', status: 'جديد', channel: 'Shopify', amount: '450 ر.س', state: 'new' },
    { id: '#ORD-1235', customer: 'فاطمة علي', status: 'محجوز', channel: 'WooCommerce', amount: '890 ر.س', state: 'reserved' },
    { id: '#ORD-1236', customer: 'خالد محمود', status: 'قيد الشحن', channel: 'Shopify', amount: '1,250 ر.س', state: 'in_transit' },
    { id: '#ORD-1237', customer: 'نورة سعيد', status: 'تم التسليم', channel: 'WooCommerce', amount: '670 ر.س', state: 'delivered' },
    { id: '#ORD-1238', customer: 'عبدالله يوسف', status: 'معلق', channel: 'Shopify', amount: '320 ر.س', state: 'pending_payment' },
  ];

  const getStatusColor = (state: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      reserved: 'bg-purple-100 text-purple-700',
      in_transit: 'bg-yellow-100 text-yellow-700',
      delivered: 'bg-green-100 text-green-700',
      pending_payment: 'bg-orange-100 text-orange-700',
    };
    return colors[state] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">لوحة التحكم</h1>
        <p className="text-gray-600">نظرة عامة على عمليات التجارة الإلكترونية</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <span className={`text-sm ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change}
                </span>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl">الطلبات الأخيرة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm text-gray-600">المبلغ</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">القناة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الحالة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">العميل</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">رقم الطلب</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">{order.amount}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100">
                      {order.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(order.state)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{order.customer}</td>
                  <td className="px-6 py-4">{order.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order State Flow */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl mb-6">دورة حياة الطلب (11 حالة)</h2>
        <div className="grid grid-cols-11 gap-2">
          {[
            { name: 'جديد', color: 'blue' },
            { name: 'معلق', color: 'orange' },
            { name: 'محجوز', color: 'purple' },
            { name: 'جاهز', color: 'indigo' },
            { name: 'شحنة', color: 'teal' },
            { name: 'بالطريق', color: 'yellow' },
            { name: 'تسليم', color: 'green' },
            { name: 'ملغي', color: 'red' },
            { name: 'مرتجع', color: 'pink' },
            { name: 'مفشل', color: 'gray' },
            { name: 'محتجز', color: 'amber' },
          ].map((state, index) => (
            <div key={index} className="text-center">
              <div className={`w-full h-2 rounded-full bg-${state.color}-500 mb-2`}></div>
              <p className="text-xs text-gray-600">{state.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
