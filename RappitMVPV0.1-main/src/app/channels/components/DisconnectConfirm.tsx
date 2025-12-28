'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Channel } from '@/lib/types/channels';
import { useDeleteChannel } from '@/lib/hooks/useChannels';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface DisconnectConfirmProps {
  channel: Channel | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DisconnectConfirm({ channel, isOpen, onClose }: DisconnectConfirmProps) {
  const { mutate: deleteChannel, isPending } = useDeleteChannel();
  const { showToast } = useToast();

  const handleDisconnect = () => {
    if (!channel) return;

    deleteChannel(channel.id, {
      onSuccess: () => {
        showToast('تم قطع الاتصال بنجاح', 'success');
        onClose();
      },
      onError: (error: any) => {
        showToast(error.message || 'فشل قطع الاتصال', 'error');
      },
    });
  };

  if (!isOpen || !channel) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div
        className="bg-white rounded-lg w-full max-w-md"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg">تأكيد قطع الاتصال</h3>
          </div>

          <p className="text-gray-700 mb-4">
            هل أنت متأكد من قطع الاتصال بـ <strong>{channel.name}</strong>؟
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-orange-800 mb-2">⚠️ تحذير:</p>
            <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
              <li>سيتوقف استيراد الطلبات الجديدة</li>
              <li>لن يتم تحديث حالات الطلبات الحالية</li>
              <li>سيتم الاحتفاظ بالطلبات المستوردة سابقاً</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Spinner size="sm" />
                  <span>جاري القطع...</span>
                </>
              ) : (
                <span>قطع الاتصال</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
