'use client';

import { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { ORDER_STATUSES } from '@/lib/types/orders';
import { useChangeOrderStatus } from '@/lib/hooks/useOrders';
import { useToast } from '@/components/UI/Toast';
import { StatusPill } from '@/components/UI/StatusPill';

interface StatusDropdownProps {
  orderId: string;
  currentStatus: string;
}

export function StatusDropdown({ orderId, currentStatus }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const { mutate: changeStatus, isPending } = useChangeOrderStatus();
  const { showToast } = useToast();

  const destructiveStatuses = ['CANCELLED', 'RETURNED', 'FAILED'];

  const handleStatusClick = (newStatus: string) => {
    setIsOpen(false);

    if (newStatus === currentStatus) {
      return;
    }

    if (destructiveStatuses.includes(newStatus.toUpperCase())) {
      setPendingStatus(newStatus);
      setShowConfirm(true);
    } else {
      submitStatusChange(newStatus);
    }
  };

  const submitStatusChange = (newStatus: string, comment?: string) => {
    changeStatus(
      {
        id: orderId,
        payload: {
          newStatus,
          comment,
          actorType: 'OPERATIONS',
        },
      },
      {
        onSuccess: () => {
          showToast('تم تحديث حالة الطلب بنجاح', 'success');
          setShowConfirm(false);
          setPendingStatus(null);
        },
        onError: (error: any) => {
          showToast(
            error?.message || 'فشل تحديث حالة الطلب',
            'error'
          );
          setShowConfirm(false);
          setPendingStatus(null);
        },
      }
    );
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-4 h-4" />
          <span>تغيير الحالة</span>
          <StatusPill status={currentStatus} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusClick(status)}
                  disabled={status === currentStatus}
                  className={`w-full px-4 py-2 text-right hover:bg-gray-50 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed ${
                    status === currentStatus ? 'bg-blue-50' : ''
                  }`}
                >
                  <StatusPill status={status} />
                  {destructiveStatuses.includes(status) && (
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && pendingStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" dir="rtl">
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg">تأكيد تغيير الحالة</h3>
            </div>

            <p className="text-gray-600 mb-6">
              هل أنت متأكد من تغيير حالة الطلب إلى <StatusPill status={pendingStatus} />؟
              هذا الإجراء قد يكون غير قابل للتراجع.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingStatus(null);
                }}
                disabled={isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => submitStatusChange(pendingStatus)}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'جاري التحديث...' : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
