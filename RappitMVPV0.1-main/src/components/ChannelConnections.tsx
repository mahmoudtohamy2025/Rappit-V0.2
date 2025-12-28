import { ShoppingBag, CheckCircle, XCircle, RefreshCw, Settings, Plus } from 'lucide-react';

export function ChannelConnections() {
  const channels = [
    {
      id: '1',
      type: 'Shopify',
      name: 'متجر الإلكترونيات',
      url: 'electronics-store.myshopify.com',
      status: 'connected',
      lastSync: '2025-12-12 10:45',
      ordersImported: 1247,
      logo: '🛍️',
      webhooksActive: true,
    },
    {
      id: '2',
      type: 'WooCommerce',
      name: 'متجر الأزياء',
      url: 'fashion-store.com',
      status: 'connected',
      lastSync: '2025-12-12 10:30',
      ordersImported: 892,
      logo: '🛒',
      webhooksActive: true,
    },
    {
      id: '3',
      type: 'Shopify',
      name: 'متجر المنزل',
      url: 'home-store.myshopify.com',
      status: 'error',
      lastSync: '2025-12-11 15:20',
      ordersImported: 456,
      logo: '🛍️',
      webhooksActive: false,
      error: 'خطأ في المصادقة - يرجى إعادة الاتصال',
    },
    {
      id: '4',
      type: 'WooCommerce',
      name: 'متجر الإكسسوارات',
      url: 'accessories-store.com',
      status: 'syncing',
      lastSync: 'جاري المزامنة...',
      ordersImported: 234,
      logo: '🛒',
      webhooksActive: true,
    },
  ];

  const mappings = [
    {
      channel: 'Shopify - متجر الإلكترونيات',
      channelSKU: 'SHOP-ELEC-001',
      internalSKU: 'ELEC-001',
      productName: 'سماعة لاسلكية بلوتوث',
      status: 'mapped',
    },
    {
      channel: 'WooCommerce - متجر الأزياء',
      channelSKU: 'WOO-FASH-234',
      internalSKU: 'FASH-234',
      productName: 'قميص رجالي - أزرق',
      status: 'mapped',
    },
    {
      channel: 'Shopify - متجر المنزل',
      channelSKU: 'SHOP-HOME-890',
      internalSKU: 'HOME-890',
      productName: 'طقم أواني مطبخ',
      status: 'mapped',
    },
    {
      channel: 'WooCommerce - متجر الإكسسوارات',
      channelSKU: 'WOO-ACC-999',
      internalSKU: '',
      productName: 'حزام جلدي',
      status: 'unmapped',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
            <CheckCircle className="w-4 h-4" />
            متصل
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
            <XCircle className="w-4 h-4" />
            خطأ
          </span>
        );
      case 'syncing':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            <RefreshCw className="w-4 h-4 animate-spin" />
            جاري المزامنة
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">القنوات المتصلة</h1>
          <p className="text-gray-600">إدارة اتصالات Shopify و WooCommerce</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          <span>إضافة قناة</span>
        </button>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <div key={channel.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{channel.logo}</div>
                <div>
                  <h3 className="text-lg">{channel.name}</h3>
                  <p className="text-sm text-gray-600">{channel.type}</p>
                  <p className="text-xs text-gray-500 mt-1">{channel.url}</p>
                </div>
              </div>
              {getStatusBadge(channel.status)}
            </div>

            {channel.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{channel.error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">آخر مزامنة</p>
                <p className="text-sm">{channel.lastSync}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">الطلبات المستوردة</p>
                <p className="text-sm">{channel.ordersImported.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">Webhooks:</span>
              {channel.webhooksActive ? (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  نشط
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-red-600">
                  <XCircle className="w-4 h-4" />
                  غير نشط
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <RefreshCw className="w-4 h-4" />
                <span>مزامنة</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Settings className="w-4 h-4" />
                <span>إعدادات</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SKU Mappings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl">تعيين SKU (محرك التعيين)</h2>
          <p className="text-sm text-gray-600 mt-1">ربط SKUs الخاصة بالقنوات مع SKUs الداخلية</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-sm text-gray-600">الحالة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">اسم المنتج</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">SKU الداخلي</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">SKU القناة</th>
                <th className="px-6 py-3 text-right text-sm text-gray-600">القناة</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping, index) => (
                <tr key={index} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    {mapping.status === 'mapped' ? (
                      <span className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm">معين</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-orange-600">
                        <XCircle className="w-4 h-4" />
                        <span className="text-sm">غير معين</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">{mapping.productName}</td>
                  <td className="px-6 py-4">
                    {mapping.internalSKU ? (
                      <span className="font-mono text-sm">{mapping.internalSKU}</span>
                    ) : (
                      <button className="text-sm text-blue-600 hover:underline">تعيين الآن</button>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-600">{mapping.channelSKU}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">{mapping.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
