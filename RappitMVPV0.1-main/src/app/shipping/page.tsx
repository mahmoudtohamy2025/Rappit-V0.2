'use client';

import { useState } from 'react';
import { Truck, AlertTriangle } from 'lucide-react';
import { useShippingAccounts, useDeleteShippingAccount, useTestConnection } from '@/lib/hooks/useShipping';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';
import { ErrorState } from '@/components/UI/ErrorState';
import { CarrierCard } from './components/CarrierCard';
import { ShippingAccountForm } from './components/ShippingAccountForm';
import { TestConnectionResult } from './components/TestConnectionResult';
import type { ShippingAccount, CarrierType, TestConnectionResult as TestResult } from '@/lib/types/shipping';

export default function ShippingPage() {
  const [selectedCarrier, setSelectedCarrier] = useState<CarrierType | null>(null);
  const [editingAccount, setEditingAccount] = useState<ShippingAccount | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<ShippingAccount | null>(null);
  const [testingAccount, setTestingAccount] = useState<ShippingAccount | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const { data: accounts, isLoading, error, refetch } = useShippingAccounts();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteShippingAccount();
  const { mutate: testConnection, isPending: isTesting } = useTestConnection();
  const { showToast } = useToast();

  const handleAddAccount = (carrier: CarrierType) => {
    setSelectedCarrier(carrier);
    setEditingAccount(null);
  };

  const handleEditAccount = (account: ShippingAccount) => {
    setEditingAccount(account);
    setSelectedCarrier(null);
  };

  const handleDeleteAccount = (account: ShippingAccount) => {
    setAccountToDelete(account);
  };

  const confirmDelete = () => {
    if (!accountToDelete) return;

    deleteAccount(accountToDelete.id, {
      onSuccess: () => {
        showToast('تم حذف حساب الشحن بنجاح', 'success');
        setAccountToDelete(null);
      },
      onError: (error: any) => {
        showToast(error.message || 'فشل حذف الحساب', 'error');
      },
    });
  };

  const handleTestConnection = (account: ShippingAccount) => {
    setTestingAccount(account);
    setTestResult(null);

    testConnection(
      { id: account.id },
      {
        onSuccess: (result) => {
          setTestResult(result);
        },
        onError: (error: any) => {
          setTestResult({
            ok: false,
            details: {
              message: error.message || 'فشل اختبار الاتصال',
            },
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ErrorState
          message={error instanceof Error ? error.message : 'فشل تحميل حسابات الشحن'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const carriers: CarrierType[] = ['DHL', 'FEDEX'];

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl mb-2">إعدادات الشحن</h1>
        <p className="text-gray-600">إدارة حسابات شركات الشحن (DHL و FedEx)</p>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg text-blue-900 mb-3 flex items-center gap-2">
          <Truck className="w-5 h-5" />
          <span>إنشاء شحنات بنقرة واحدة</span>
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>✓ إنشاء ملصقات الشحن تلقائياً</p>
          <p>✓ تتبع الشحنات في الوقت الفعلي</p>
          <p>✓ أسعار شحن تنافسية مباشرة من الناقل</p>
          <p>✓ دعم الوضع التجريبي (Sandbox) للاختبار</p>
        </div>
      </div>

      {/* Carrier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {carriers.map((carrier) => (
          <CarrierCard
            key={carrier}
            carrier={carrier}
            accounts={accounts || []}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onTestConnection={handleTestConnection}
          />
        ))}
      </div>

      {/* Security Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg text-yellow-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span>ملاحظات أمنية</span>
        </h3>
        <div className="space-y-2 text-sm text-yellow-800">
          <p>🔒 يتم تشفير جميع مفاتيح API وحفظها بشكل آمن</p>
          <p>🔒 يتم إرسال البيانات عبر HTTPS فقط</p>
          <p>🔒 لا يتم عرض المفاتيح الفعلية في واجهة المستخدم</p>
          <p>🔒 يتم استخدام Cookies آمنة للمصادقة</p>
        </div>
      </div>

      {/* Shipping Account Form Modal */}
      <ShippingAccountForm
        carrier={selectedCarrier}
        account={editingAccount}
        isOpen={!!selectedCarrier || !!editingAccount}
        onClose={() => {
          setSelectedCarrier(null);
          setEditingAccount(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg">تأكيد الحذف</h3>
            </div>

            <p className="text-gray-700 mb-6">
              هل أنت متأكد من حذف حساب الشحن <strong>{accountToDelete.name || accountToDelete.carrier}</strong>؟
              لن تتمكن من إنشاء شحنات جديدة باستخدام هذا الحساب.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setAccountToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Spinner size="sm" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>حذف</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Connection Result Modal */}
      <TestConnectionResult
        result={testResult}
        isOpen={!!testingAccount}
        isLoading={isTesting}
        onClose={() => {
          setTestingAccount(null);
          setTestResult(null);
        }}
      />
    </div>
  );
}
