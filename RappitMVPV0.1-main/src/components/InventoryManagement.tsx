import { Package, AlertTriangle, TrendingUp, Warehouse } from 'lucide-react';

export function InventoryManagement() {
  const inventoryItems = [
    {
      sku: 'ELEC-001',
      name: 'سماعة لاسلكية بلوتوث',
      category: 'إلكترونيات',
      available: 45,
      reserved: 12,
      total: 57,
      lowStock: false,
      location: 'مستودع الرياض',
      lastUpdate: '2025-12-12 09:30',
    },
    {
      sku: 'ELEC-045',
      name: 'شاحن سريع USB-C',
      category: 'إلكترونيات',
      available: 8,
      reserved: 5,
      total: 13,
      lowStock: true,
      location: 'مستودع جدة',
      lastUpdate: '2025-12-12 08:15',
    },
    {
      sku: 'FASH-234',
      name: 'قميص رجالي - أزرق',
      category: 'أزياء',
      available: 120,
      reserved: 23,
      total: 143,
      lowStock: false,
      location: 'مستودع الرياض',
      lastUpdate: '2025-12-11 16:45',
    },
    {
      sku: 'FASH-567',
      name: 'بنطال جينز - أسود',
      category: 'أزياء',
      available: 67,
      reserved: 15,
      total: 82,
      lowStock: false,
      location: 'مستودع الدمام',
      lastUpdate: '2025-12-11 14:20',
    },
    {
      sku: 'HOME-890',
      name: 'طقم أواني مطبخ',
      category: 'منزل وديكور',
      available: 34,
      reserved: 8,
      total: 42,
      lowStock: false,
      location: 'مستودع الرياض',
      lastUpdate: '2025-12-10 11:30',
    },
    {
      sku: 'ACC-123',
      name: 'حقيبة يد جلدية',
      category: 'إكسسوارات',
      available: 3,
      reserved: 7,
      total: 10,
      lowStock: true,
      location: 'مستودع جدة',
      lastUpdate: '2025-12-10 09:00',
    },
  ];

  const stats = [
    {
      label: 'إجمالي المنتجات',
      value: '347',
      icon: Package,
      color: 'blue',
    },
    {
      label: 'المحجوزة (Model C)',
      value: '70',
      icon: Warehouse,
      color: 'purple',
    },
    {
      label: 'منخفض المخزون',
      value: '12',
      icon: AlertTriangle,
      color: 'orange',
    },
    {
      label: 'معدل الدوران',
      value: '2.4x',
      icon: TrendingUp,
      color: 'green',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">إدارة المخزون</h1>
        <p className="text-gray-600">نموذج C - الحجز التلقائي عند الاستيراد</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Model C Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg mb-3 text-blue-900">نموذج C للحجز التلقائي</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>✓ يتم حجز المخزون تلقائياً عند استيراد الطلب</p>
          <p>✓ يتم إطلاق المخزون عند إلغاء الطلب أو إرجاعه</p>
          <p>✓ يضمن عدم البيع الزائد (Overselling)</p>
          <p>✓ تتبع دقيق للمخزون المتاح والمحجوز</p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl">قائمة المخزون</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + إضافة منتج
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm text-gray-600">آخر تحديث</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الموقع</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الإجمالي</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">المحجوز</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">المتاح</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الفئة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">اسم المنتج</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">SKU</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((item) => (
                <tr key={item.sku} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{item.lastUpdate}</td>
                  <td className="px-6 py-4 text-sm">{item.location}</td>
                  <td className="px-6 py-4">
                    <span className="text-gray-900">{item.total}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {item.reserved}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={item.lowStock ? 'text-red-600' : 'text-green-600'}>
                        {item.available}
                      </span>
                      {item.lowStock && (
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{item.category}</span>
                  </td>
                  <td className="px-6 py-4">{item.name}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm">{item.sku}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
