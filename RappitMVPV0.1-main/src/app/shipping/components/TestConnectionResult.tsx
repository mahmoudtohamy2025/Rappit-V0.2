'use client';

import { X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { TestConnectionResult as TestResult } from '@/lib/types/shipping';

interface TestConnectionResultProps {
  result: TestResult | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
}

export function TestConnectionResult({ result, isOpen, isLoading, onClose }: TestConnectionResultProps) {
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
          <h2 className="text-xl">نتيجة اختبار الاتصال</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Clock className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-gray-700">جاري اختبار الاتصال...</p>
              <p className="text-sm text-gray-500 mt-2">قد يستغرق هذا بضع ثوان</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                {result.ok ? (
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                )}
                <h3 className={`text-xl mb-2 ${result.ok ? 'text-green-900' : 'text-red-900'}`}>
                  {result.ok ? 'نجح الاتصال!' : 'فشل الاتصال'}
                </h3>
                <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
                  {result.details.message}
                </p>
              </div>

              {/* Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">وقت الاستجابة:</span>
                  <span className="font-mono">
                    {result.details.latencyMs ? `${result.details.latencyMs} ms` : '-'}
                  </span>
                </div>

                {result.details.testType && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">نوع الاختبار:</span>
                    <span>{result.details.testType}</span>
                  </div>
                )}

                {result.details.carrierStatus && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">حالة الناقل:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      {result.details.carrierStatus}
                    </span>
                  </div>
                )}

                {/* Show other details */}
                {Object.entries(result.details).map(([key, value]) => {
                  if (['message', 'latencyMs', 'testType', 'carrierStatus'].includes(key)) {
                    return null;
                  }
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-mono text-xs">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!result.ok && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
                  <p className="text-yellow-900 mb-2">💡 خطوات استكشاف الأخطاء:</p>
                  <ul className="text-yellow-800 space-y-1 list-disc list-inside text-xs">
                    <li>تحقق من صحة مفاتيح API</li>
                    <li>تأكد من تفعيل الحساب لدى الناقل</li>
                    <li>تحقق من إعدادات الجدار الناري (Firewall)</li>
                    <li>تأكد من اختيار الوضع الصحيح (اختبار/إنتاج)</li>
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-center mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
