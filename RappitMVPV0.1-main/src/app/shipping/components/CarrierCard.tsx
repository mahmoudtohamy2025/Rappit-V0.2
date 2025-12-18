'use client';

import { Truck, Plus, Edit, Trash2, TestTube } from 'lucide-react';
import { ShippingAccount, CarrierType } from '@/lib/types/shipping';

interface CarrierCardProps {
  carrier: CarrierType;
  accounts: ShippingAccount[];
  onAddAccount: (carrier: CarrierType) => void;
  onEditAccount: (account: ShippingAccount) => void;
  onDeleteAccount: (account: ShippingAccount) => void;
  onTestConnection: (account: ShippingAccount) => void;
}

export function CarrierCard({
  carrier,
  accounts,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onTestConnection,
}: CarrierCardProps) {
  const carrierInfo = {
    DHL: {
      name: 'DHL',
      logo: '📦',
      color: 'red',
      description: 'شحن عالمي سريع وموثوق',
    },
    FEDEX: {
      name: 'FedEx',
      logo: '✈️',
      color: 'purple',
      description: 'خدمات شحن دولية متميزة',
    },
  };

  const info = carrierInfo[carrier];
  const carrierAccounts = accounts.filter((acc) => acc.carrier === carrier);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'ERROR':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'لم يتم الاختبار بعد';

    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{info.logo}</div>
          <div>
            <h3 className="text-xl">{info.name}</h3>
            <p className="text-sm text-gray-600">{info.description}</p>
          </div>
        </div>
        <button
          onClick={() => onAddAccount(carrier)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حساب</span>
        </button>
      </div>

      {carrierAccounts.length > 0 ? (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          {carrierAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium">{account.name || `حساب ${carrier}`}</p>
                  <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(account.status)}`}>
                    {account.status === 'CONNECTED' ? 'متصل' : account.status === 'ERROR' ? 'خطأ' : account.status}
                  </span>
                  {account.testMode && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                      وضع تجريبي
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>رقم الحساب: <span className="font-mono">{account.accountNumber}</span></p>
                  <p>آخر اختبار: {formatDate(account.lastTestAt)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onTestConnection(account)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="اختبار الاتصال"
                >
                  <TestTube className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEditAccount(account)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="تعديل"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteAccount(account)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="pt-4 border-t border-gray-200 text-center text-gray-500 py-8">
          <Truck className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">لا توجد حسابات {carrier} متصلة</p>
          <p className="text-xs mt-1">انقر على "إضافة حساب" للبدء</p>
        </div>
      )}
    </div>
  );
}
