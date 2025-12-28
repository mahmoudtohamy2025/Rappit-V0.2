import { useState } from 'react';
import { Search, Filter, Download, RefreshCw, Eye, Package, Truck } from 'lucide-react';

export function OrdersManagement() {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const orders = [
    {
      id: '#ORD-1234',
      customer: 'محمد أحمد السعيد',
      email: 'mohammed@example.com',
      channel: 'Shopify',
      status: 'new',
      statusLabel: 'جديد',
      items: 3,
      amount: '1,450.00 ر.س',
      date: '2025-12-12 10:30',
      shipping: 'DHL',
      sku: 'ELEC-001, ELEC-045, ACC-123',
    },
    {
      id: '#ORD-1235',
      customer: 'فاطمة علي محمود',
      email: 'fatima@example.com',
      channel: 'WooCommerce',
      status: 'reserved',
      statusLabel: 'محجوز (المخزون)',
      items: 2,
      amount: '890.00 ر.س',
      date: '2025-12-12 09:15',
      shipping: 'FedEx',
      sku: 'FASH-234, FASH-567',
    },
    {
      id: '#ORD-1236',
      customer: 'خالد محمود عبدالله',
      email: 'khaled@example.com',
      channel: 'Shopify',
      status: 'ready_to_ship',
      statusLabel: 'جاهز للشحن',
      items: 5,
      amount: '2,340.00 ر.س',
      date: '2025-12-11 16:45',
      shipping: 'DHL',
      sku: 'HOME-890, HOME-123, DEC-456',
    },
    {
      id: '#ORD-1237',
      customer: 'نورة سعيد الأحمد',
      email: 'noura@example.com',
      channel: 'WooCommerce',
      status: 'shipped',
      statusLabel: 'تم الشحن',
      items: 1,
      amount: '670.00 ر.س',
      date: '2025-12-11 14:20',
      shipping: 'FedEx',
      sku: 'ELEC-789',
      tracking: 'FDX123456789'
    },
    {
      id: '#ORD-1238',
      customer: 'عبدالله يوسف محمد',
      email: 'abdullah@example.com',
      channel: 'Shopify',
      status: 'in_transit',
      statusLabel: 'قيد التوصيل',
      items: 4,
      amount: '1,890.00 ر.س',
      date: '2025-12-10 11:30',
      shipping: 'DHL',
      sku: 'FASH-111, FASH-222, ACC-333',
      tracking: 'DHL987654321'
    },
    {
      id: '#ORD-1239',
      customer: 'سارة حسن علي',
      email: 'sarah@example.com',
      channel: 'WooCommerce',
      status: 'delivered',
      statusLabel: 'تم التسليم',
      items: 2,
      amount: '1,120.00 ر.س',
      date: '2025-12-09 08:45',
      shipping: 'DHL',
      sku: 'HOME-555, DEC-666',
      tracking: 'DHL555666777'
    },
    {
      id: '#ORD-1240',
      customer: 'عمر محمد الحسني',
      email: 'omar@example.com',
      channel: 'Shopify',
      status: 'pending_payment',
      statusLabel: 'معلق - الدفع',
      items: 1,
      amount: '320.00 ر.س',
      date: '2025-12-12 07:30',
      shipping: 'FedEx',
      sku: 'ACC-999',
    },
    {
      id: '#ORD-1241',
      customer: 'ليلى أحمد سالم',
      email: 'layla@example.com',
      channel: 'WooCommerce',
      status: 'cancelled',
      statusLabel: 'ملغي',
      items: 3,
      amount: '750.00 ر.س',
      date: '2025-12-11 18:00',
      shipping: 'DHL',
      sku: 'ELEC-111, ELEC-222',
    },
  ];

  const statusOptions = [
    { value: 'all', label: 'جميع الحالات', count: orders.length },
    { value: 'new', label: 'جديد', count: 1 },
    { value: 'reserved', label: 'محجوز', count: 1 },
    { value: 'ready_to_ship', label: 'جاهز للشحن', count: 1 },
    { value: 'shipped', label: 'تم الشحن', count: 1 },
    { value: 'in_transit', label: 'قيد التوصيل', count: 1 },
    { value: 'delivered', label: 'تم التسليم', count: 1 },
    { value: 'cancelled', label: 'ملغي', count: 1 },
    { value: 'pending_payment', label: 'معلق - الدفع', count: 1 },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700 border-blue-200',
      reserved: 'bg-purple-100 text-purple-700 border-purple-200',
      ready_to_ship: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      shipped: 'bg-teal-100 text-teal-700 border-teal-200',
      in_transit: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      delivered: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      pending_payment: 'bg-orange-100 text-orange-700 border-orange-200',
      returned: 'bg-pink-100 text-pink-700 border-pink-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">إدارة الطلبات</h1>
          <p className="text-gray-600">عرض وإدارة جميع الطلبات عبر القنوات</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" />
            <span>مزامنة</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2 overflow-x-auto">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedStatus(option.value)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedStatus === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الطلب، اسم العميل، أو البريد الإلكتروني..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          <span>تصفية</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm text-gray-600">إجراءات</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">تتبع</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">التاريخ</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">المبلغ</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">SKUs</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الشحن</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">القناة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الحالة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">العميل</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">رقم الطلب</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      {order.status === 'ready_to_ship' && (
                        <button className="p-2 text-green-600 hover:bg-green-50 rounded">
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.tracking && (
                      <span className="text-sm text-blue-600">{order.tracking}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.date}</td>
                  <td className="px-6 py-4">{order.amount}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{order.items} منتجات</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{order.sku}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100">
                      {order.shipping}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100">
                      {order.channel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${getStatusColor(order.status)}`}>
                      {order.statusLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p>{order.customer}</p>
                      <p className="text-sm text-gray-500">{order.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">{order.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
