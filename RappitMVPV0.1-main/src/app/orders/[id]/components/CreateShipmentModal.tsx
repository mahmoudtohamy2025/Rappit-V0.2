'use client';

import { useState } from 'react';
import { X, Truck, CheckCircle } from 'lucide-react';
import { OrderItem } from '@/lib/types/orders';
import { useCreateShipment } from '@/lib/hooks/useOrder';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface CreateShipmentModalProps {
  orderId: string;
  items: OrderItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function CreateShipmentModal({
  orderId,
  items,
  isOpen,
  onClose,
}: CreateShipmentModalProps) {
  const [carrier, setCarrier] = useState('dhl');
  const [service, setService] = useState('express');
  const [selectedItems, setSelectedItems] = useState<{ skuId: string; quantity: number }[]>(
    items
      .filter((item) => (item.shippedQuantity || 0) < item.quantity)
      .map((item) => ({
        skuId: item.skuId,
        quantity: item.quantity - (item.shippedQuantity || 0),
      }))
  );
  const [success, setSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');

  const { mutate: createShipment, isPending } = useCreateShipment();
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      showToast('يرجى تحديد المنتجات للشحن', 'error');
      return;
    }

    // Generate idempotency key
    const idempotencyKey = `${orderId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    createShipment(
      {
        orderId,
        payload: {
          carrier,
          service,
          items: selectedItems,
        },
        idempotencyKey,
      },
      {
        onSuccess: (shipment) => {
          setSuccess(true);
          setTrackingNumber(shipment.trackingNumber);
          showToast('تم إنشاء الشحنة بنجاح', 'success');
        },
        onError: (error: any) => {
          showToast(error?.message || 'فشل إنشاء الشحنة', 'error');
        },
      }
    );
  };

  const handleClose = () => {
    setSuccess(false);
    setTrackingNumber('');
    onClose();
  };

  const updateItemQuantity = (skuId: string, quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.skuId === skuId ? { ...item, quantity } : item))
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="p-6">
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl mb-2">تم إنشاء الشحنة بنجاح!</h3>
              <p className="text-gray-600 mb-4">رقم التتبع:</p>
              <div className="inline-block px-6 py-3 bg-blue-50 rounded-lg">
                <p className="text-xl font-mono text-blue-600">{trackingNumber}</p>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <Truck className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl">إنشاء شحنة جديدة</h2>
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
              {/* Carrier Selection */}
              <div>
                <label className="block text-sm mb-2">شركة الشحن</label>
                <select
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isPending}
                  required
                >
                  <option value="dhl">DHL</option>
                  <option value="fedex">FedEx</option>
                </select>
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-sm mb-2">نوع الخدمة</label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isPending}
                  required
                >
                  <option value="express">سريع (Express)</option>
                  <option value="standard">عادي (Standard)</option>
                  <option value="economy">اقتصادي (Economy)</option>
                </select>
              </div>

              {/* Items Selection */}
              <div>
                <label className="block text-sm mb-2">المنتجات للشحن</label>
                <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {items.map((item) => {
                    const remaining = item.quantity - (item.shippedQuantity || 0);
                    const selectedItem = selectedItems.find((si) => si.skuId === item.skuId);

                    if (remaining <= 0) return null;

                    return (
                      <div key={item.skuId} className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            SKU: {item.skuId} • متاح للشحن: {remaining}
                          </p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          value={selectedItem?.quantity || 0}
                          onChange={(e) =>
                            updateItemQuantity(item.skuId, parseInt(e.target.value) || 0)
                          }
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isPending}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

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
                  disabled={isPending || selectedItems.every((item) => item.quantity === 0)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Spinner size="sm" />
                      <span>جاري الإنشاء...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      <span>إنشاء شحنة</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
