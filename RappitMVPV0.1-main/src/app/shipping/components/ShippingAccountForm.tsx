'use client';

import { useState, useEffect } from 'react';
import { X, Truck } from 'lucide-react';
import { ShippingAccount, CarrierType } from '@/lib/types/shipping';
import { useCreateShippingAccount, useUpdateShippingAccount } from '@/lib/hooks/useShipping';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface ShippingAccountFormProps {
  carrier: CarrierType | null;
  account?: ShippingAccount;
  isOpen: boolean;
  onClose: () => void;
}

export function ShippingAccountForm({ carrier, account, isOpen, onClose }: ShippingAccountFormProps) {
  const [accountNumber, setAccountNumber] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [name, setName] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate: createAccount, isPending: isCreating } = useCreateShippingAccount();
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateShippingAccount();
  const { showToast } = useToast();

  const isPending = isCreating || isUpdating;
  const isEditing = !!account;

  useEffect(() => {
    if (account) {
      setAccountNumber(account.accountNumber);
      setName(account.name || '');
      setTestMode(account.testMode);
      // Don't populate API keys for security
      setApiKey('');
      setApiSecret('');
    } else if (carrier) {
      setAccountNumber('');
      setApiKey('');
      setApiSecret('');
      setName('');
      setTestMode(false);
    }
  }, [account, carrier]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!accountNumber.trim()) {
      newErrors.accountNumber = 'رقم الحساب مطلوب';
    }

    if (!isEditing || apiKey.trim()) {
      if (!apiKey.trim()) {
        newErrors.apiKey = 'مفتاح API مطلوب';
      }
    }

    if (!isEditing || apiSecret.trim()) {
      if (!apiSecret.trim()) {
        newErrors.apiSecret = 'سر API مطلوب';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (isEditing && account) {
      // Update existing account
      const payload: any = {
        accountNumber: accountNumber.trim(),
        name: name.trim() || undefined,
        testMode,
      };

      // Only include API credentials if they were changed
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      if (apiSecret.trim()) payload.apiSecret = apiSecret.trim();

      updateAccount(
        { id: account.id, payload },
        {
          onSuccess: () => {
            showToast('تم تحديث حساب الشحن بنجاح', 'success');
            handleClose();
          },
          onError: (error: any) => {
            handleErrors(error);
          },
        }
      );
    } else if (carrier) {
      // Create new account
      createAccount(
        {
          carrier,
          accountNumber: accountNumber.trim(),
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          name: name.trim() || undefined,
          testMode,
        },
        {
          onSuccess: () => {
            showToast('تم إضافة حساب الشحن بنجاح', 'success');
            handleClose();
          },
          onError: (error: any) => {
            handleErrors(error);
          },
        }
      );
    }
  };

  const handleErrors = (error: any) => {
    if (error.errors) {
      const fieldErrors: Record<string, string> = {};
      error.errors.forEach((err: any) => {
        if (err.field) {
          fieldErrors[err.field] = err.message;
        }
      });
      setErrors(fieldErrors);
    }
    showToast(error.message || 'فشلت العملية', 'error');
  };

  const handleClose = () => {
    setAccountNumber('');
    setApiKey('');
    setApiSecret('');
    setName('');
    setTestMode(false);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  const carrierName = carrier || account?.carrier || '';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div
        className="bg-white rounded-lg w-full max-w-md"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl">
              {isEditing ? 'تعديل' : 'إضافة'} حساب {carrierName}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm mb-2">
              رقم الحساب <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={`رقم حساب ${carrierName}`}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.accountNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.accountNumber && (
              <p className="text-sm text-red-600 mt-1">{errors.accountNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">
              مفتاح API {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : 'مفتاح API'}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                errors.apiKey ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.apiKey && (
              <p className="text-sm text-red-600 mt-1">{errors.apiKey}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">
              سر API {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : 'سر API'}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                errors.apiSecret ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.apiSecret && (
              <p className="text-sm text-red-600 mt-1">{errors.apiSecret}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">اسم الحساب (اختياري)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`مثال: حساب ${carrierName} الرئيسي`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="testMode"
              checked={testMode}
              onChange={(e) => setTestMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
            />
            <label htmlFor="testMode" className="text-sm cursor-pointer">
              وضع الاختبار (Sandbox)
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p>🔒 البيانات الحساسة (مفاتيح API) يتم تشفيرها وحفظها بشكل آمن</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Spinner size="sm" />
                  <span>{isEditing ? 'جاري التحديث...' : 'جاري الإضافة...'}</span>
                </>
              ) : (
                <span>{isEditing ? 'تحديث' : 'إضافة'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
