// components/UI/StatusPill.tsx
import { OrderStatus } from '@/lib/types/orders';

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const getStatusColor = (status: string) => {
    const statusUpper = status.toUpperCase();
    const colors: Record<string, string> = {
      NEW: 'bg-blue-100 text-blue-700 border-blue-200',
      PENDING_PAYMENT: 'bg-orange-100 text-orange-700 border-orange-200',
      RESERVED: 'bg-purple-100 text-purple-700 border-purple-200',
      READY_TO_SHIP: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      SHIPPED: 'bg-teal-100 text-teal-700 border-teal-200',
      IN_TRANSIT: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      DELIVERED: 'bg-green-100 text-green-700 border-green-200',
      CANCELLED: 'bg-red-100 text-red-700 border-red-200',
      RETURNED: 'bg-pink-100 text-pink-700 border-pink-200',
      FAILED: 'bg-gray-100 text-gray-700 border-gray-200',
      ON_HOLD: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return colors[statusUpper] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    const statusUpper = status.toUpperCase();
    const labels: Record<string, string> = {
      NEW: 'جديد',
      PENDING_PAYMENT: 'معلق - الدفع',
      RESERVED: 'محجوز',
      READY_TO_SHIP: 'جاهز للشحن',
      SHIPPED: 'تم الشحن',
      IN_TRANSIT: 'قيد التوصيل',
      DELIVERED: 'تم التسليم',
      CANCELLED: 'ملغي',
      RETURNED: 'مرتجع',
      FAILED: 'فاشل',
      ON_HOLD: 'محتجز',
    };
    return labels[statusUpper] || status;
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs border ${getStatusColor(
        status
      )} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
