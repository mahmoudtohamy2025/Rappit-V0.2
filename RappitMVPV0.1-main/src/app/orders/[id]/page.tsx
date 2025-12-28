'use client';

import { useState } from 'react';
import { ArrowRight, Truck } from 'lucide-react';
import { useOrder } from '@/lib/hooks/useOrder';
import { Spinner } from '@/components/UI/Spinner';
import { ErrorState } from '@/components/UI/ErrorState';
import { OrderSummary } from './components/OrderSummary';
import { OrderItems } from './components/OrderItems';
import { OrderTimeline } from './components/OrderTimeline';
import { StatusDropdown } from './components/StatusDropdown';
import { CreateShipmentModal } from './components/CreateShipmentModal';

interface OrderDetailPageProps {
  orderId: string;
  onBack?: () => void;
}

export default function OrderDetailPage({ orderId, onBack }: OrderDetailPageProps) {
  const [showShipmentModal, setShowShipmentModal] = useState(false);

  const { data: order, isLoading, error, refetch } = useOrder(orderId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorState
          message={error instanceof Error ? error.message : 'فشل تحميل تفاصيل الطلب'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorState message="الطلب غير موجود" />
      </div>
    );
  }

  const hasShippableItems = order.items.some(
    (item) => (item.shippedQuantity || 0) < item.quantity
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl">تفاصيل الطلب</h1>
            <p className="text-gray-600">الطلب رقم {order.id}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <StatusDropdown orderId={order.id} currentStatus={order.status} />

          {hasShippableItems && (
            <button
              onClick={() => setShowShipmentModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Truck className="w-4 h-4" />
              <span>إنشاء شحنة</span>
            </button>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <OrderSummary order={order} />

      {/* Order Items */}
      <OrderItems items={order.items} currency={order.currency} />

      {/* Timeline */}
      <OrderTimeline timeline={order.timeline} />

      {/* Create Shipment Modal */}
      <CreateShipmentModal
        orderId={order.id}
        items={order.items}
        isOpen={showShipmentModal}
        onClose={() => setShowShipmentModal(false)}
      />
    </div>
  );
}
