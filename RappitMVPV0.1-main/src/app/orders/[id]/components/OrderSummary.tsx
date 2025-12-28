'use client';

import { Order } from '@/lib/types/orders';
import { StatusPill } from '@/components/UI/StatusPill';
import { Package, CreditCard, Calendar, Hash } from 'lucide-react';

interface OrderSummaryProps {
  order: Order;
}

export function OrderSummary({ order }: OrderSummaryProps) {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency || 'SAR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl mb-6">معلومات الطلب</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">رقم الطلب الداخلي</p>
              <p className="font-mono">{order.id}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">رقم الطلب بالقناة</p>
              <p className="font-mono">{order.channelOrderId}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">تاريخ الإنشاء</p>
              <p>{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">الحالة</p>
              <StatusPill status={order.status} />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">طريقة الدفع</p>
              <p>{order.paymentMethod}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5" />
            <div>
              <p className="text-sm text-gray-600 mb-1">المبلغ الإجمالي</p>
              <p className="text-2xl">{formatCurrency(order.total, order.currency)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer & Address Info */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm text-gray-600 mb-2">معلومات العميل</h3>
            <p>{order.customer.name}</p>
            {order.customer.email && (
              <p className="text-sm text-gray-600">{order.customer.email}</p>
            )}
            {order.customer.phone && (
              <p className="text-sm text-gray-600">{order.customer.phone}</p>
            )}
          </div>

          {order.shippingAddress && (
            <div>
              <h3 className="text-sm text-gray-600 mb-2">عنوان الشحن</h3>
              <p className="text-sm">
                {order.shippingAddress.street}<br />
                {order.shippingAddress.city}, {order.shippingAddress.state}<br />
                {order.shippingAddress.postalCode}<br />
                {order.shippingAddress.country}
              </p>
            </div>
          )}

          {order.billingAddress && (
            <div>
              <h3 className="text-sm text-gray-600 mb-2">عنوان الفاتورة</h3>
              <p className="text-sm">
                {order.billingAddress.street}<br />
                {order.billingAddress.city}, {order.billingAddress.state}<br />
                {order.billingAddress.postalCode}<br />
                {order.billingAddress.country}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
