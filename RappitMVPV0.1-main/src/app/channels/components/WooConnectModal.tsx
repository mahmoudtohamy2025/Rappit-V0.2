'use client';

import { useState } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { useCreateWooConnection } from '@/lib/hooks/useChannels';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface WooConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WooConnectModal({ isOpen, onClose }: WooConnectModalProps) {
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate: createConnection, isPending } = useCreateWooConnection();
  const { showToast } = useToast();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!storeUrl.trim()) {
      newErrors.storeUrl = 'عنوان المتجر مطلوب';
    } else {
      try {
        new URL(storeUrl);
      } catch {
        newErrors.storeUrl = 'عنوان URL غير صالح';
      }
    }

    if (!consumerKey.trim()) {
      newErrors.consumerKey = 'مفتاح المستهلك مطلوب';
    }

    if (!consumerSecret.trim()) {
      newErrors.consumerSecret = 'سر المستهلك مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    createConnection(
      {
        storeUrl: storeUrl.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
        name: name.trim() || undefined,
      },
      {
        onSuccess: () => {
          showToast('تم توصيل WooCommerce بنجاح', 'success');
          handleClose();
        },
        onError: (error: any) => {
          if (error.errors) {
            const fieldErrors: Record<string, string> = {};
            error.errors.forEach((err: any) => {
              if (err.field) {
                fieldErrors[err.field] = err.message;
              }
            });
            setErrors(fieldErrors);
          }
          showToast(error.message || 'فشل توصيل WooCommerce', 'error');
        },
      }
    );
  };

  const handleClose = () => {
    setStoreUrl('');
    setConsumerKey('');
    setConsumerSecret('');
    setName('');
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

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
            <ShoppingBag className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl">توصيل WooCommerce</h2>
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
              عنوان المتجر <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://mystore.com"
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                errors.storeUrl ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.storeUrl && (
              <p className="text-sm text-red-600 mt-1">{errors.storeUrl}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">
              مفتاح المستهلك (Consumer Key) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              placeholder="ck_..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm ${
                errors.consumerKey ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.consumerKey && (
              <p className="text-sm text-red-600 mt-1">{errors.consumerKey}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">
              سر المستهلك (Consumer Secret) <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              placeholder="cs_..."
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm ${
                errors.consumerSecret ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.consumerSecret && (
              <p className="text-sm text-red-600 mt-1">{errors.consumerSecret}</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">اسم الاتصال (اختياري)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: متجر الأزياء"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isPending}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="mb-2">للحصول على مفاتيح WooCommerce API:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>اذهب إلى: WooCommerce → الإعدادات → متقدم → REST API</li>
              <li>انقر على "إضافة مفتاح"</li>
              <li>اختر صلاحيات "قراءة/كتابة"</li>
              <li>انسخ المفاتيح هنا</li>
            </ol>
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
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Spinner size="sm" />
                  <span>جاري التوصيل...</span>
                </>
              ) : (
                <span>توصيل</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
