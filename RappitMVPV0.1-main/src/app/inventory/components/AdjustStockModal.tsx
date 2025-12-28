'use client';

import { useState } from 'react';
import { X, Package } from 'lucide-react';
import { InventorySku } from '@/lib/types/inventory';
import { useAdjustStock } from '@/lib/hooks/useInventory';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface AdjustStockModalProps {
  sku: InventorySku;
  isOpen: boolean;
  onClose: () => void;
}

export function AdjustStockModal({ sku, isOpen, onClose }: AdjustStockModalProps) {
  const [delta, setDelta] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const { mutate: adjustStock, isPending } = useAdjustStock();
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const deltaNum = parseInt(delta);

    if (isNaN(deltaNum) || deltaNum === 0) {
      setError('يرجى إدخال قيمة صحيحة (موجبة للإضافة، سالبة للطرح)');
      return;
    }

    if (!reason.trim()) {
      setError('يرجى إدخال سبب التعديل');
      return;
    }

    adjustStock(
      {
        skuId: sku.skuId,
        payload: {
          delta: deltaNum,
          reason: reason.trim(),
          userId: 'current-user', // Should come from auth context
        },
      },
      {
        onSuccess: () => {
          showToast('تم تعديل المخزون بنجاح', 'success');
          handleClose();
        },
        onError: (error: any) => {
          const errorMessage = error?.message || 'فشل تعديل المخزون';
          setError(errorMessage);
          showToast(errorMessage, 'error');
        },
      }
    );
  };

  const handleClose = () => {
    setDelta('');
    setReason('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const newQuantity = sku.quantityOnHand + (parseInt(delta) || 0);
  const newAvailable = newQuantity - sku.reserved;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      dir="rtl"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-md"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl">تعديل المخزون</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            disabled={isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SKU Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">المنتج</p>
            <p className="font-medium mb-1">{sku.name}</p>
            <p className="font-mono text-sm text-gray-600">{sku.sku}</p>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs text-gray-600 mb-1">الموجود</p>
                <p className="text-lg">{sku.quantityOnHand}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">المحجوز</p>
                <p className="text-lg text-purple-600">{sku.reserved}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">المتاح</p>
                <p className="text-lg text-green-600">
                  {sku.quantityOnHand - sku.reserved}
                </p>
              </div>
            </div>
          </div>

          {/* Delta Input */}
          <div>
            <label className="block text-sm mb-2">
              التغيير <span className="text-gray-500">(+ للإضافة، - للطرح)</span>
            </label>
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="مثال: +10 أو -5"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isPending}
              required
            />
          </div>

          {/* Preview */}
          {delta && parseInt(delta) !== 0 && !isNaN(parseInt(delta)) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 mb-2">النتيجة المتوقعة:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-700 mb-1">الكمية الجديدة</p>
                  <p className="text-lg text-blue-900">{newQuantity}</p>
                </div>
                <div>
                  <p className="text-xs text-blue-700 mb-1">المتاح الجديد</p>
                  <p className={`text-lg ${newAvailable < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                    {newAvailable}
                  </p>
                </div>
              </div>
              {newAvailable < 0 && (
                <p className="text-xs text-red-600 mt-2">
                  تحذير: المتاح سيصبح سالباً
                </p>
              )}
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="block text-sm mb-2">سبب التعديل</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تصحيح جرد، منتج تالف، إعادة عد..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isPending}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Spinner size="sm" />
                  <span>جاري التعديل...</span>
                </>
              ) : (
                <span>تأكيد التعديل</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
