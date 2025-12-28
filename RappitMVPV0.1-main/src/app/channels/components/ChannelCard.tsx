'use client';

import { useState } from 'react';
import { ShoppingBag, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2, Settings } from 'lucide-react';
import { Channel, ChannelProvider } from '@/lib/types/channels';
import { useCreateShopifyOAuth, useSyncChannel } from '@/lib/hooks/useChannels';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';

interface ChannelCardProps {
  channel?: Channel;
  provider: ChannelProvider;
  onConnectWoo: () => void;
  onDisconnect: (channel: Channel) => void;
}

export function ChannelCard({ channel, provider, onConnectWoo, onDisconnect }: ChannelCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { mutate: createOAuth, isPending: isCreatingOAuth } = useCreateShopifyOAuth();
  const { mutate: syncChannel } = useSyncChannel();
  const { showToast } = useToast();

  const providerInfo = {
    SHOPIFY: {
      name: 'Shopify',
      logo: '🛍️',
      color: 'green',
    },
    WOOCOMMERCE: {
      name: 'WooCommerce',
      logo: '🛒',
      color: 'purple',
    },
  };

  const info = providerInfo[provider];

  const handleConnectShopify = () => {
    createOAuth(undefined, {
      onSuccess: (data) => {
        // Redirect to Shopify OAuth
        window.location.href = data.redirectUrl;
      },
      onError: (error: any) => {
        showToast(error.message || 'فشل الاتصال بـ Shopify', 'error');
      },
    });
  };

  const handleSync = () => {
    if (!channel) return;

    setIsSyncing(true);
    syncChannel(channel.id, {
      onSuccess: (data) => {
        showToast(`تم بدء المزامنة - معرف المهمة: ${data.jobId}`, 'success');
        setIsSyncing(false);
      },
      onError: (error: any) => {
        showToast(error.message || 'فشلت المزامنة', 'error');
        setIsSyncing(false);
      },
    });
  };

  const getStatusIcon = () => {
    if (!channel) return <XCircle className="w-5 h-5 text-gray-400" />;

    switch (channel.status) {
      case 'CONNECTED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'ERROR':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getRelativeTime = (dateString: string | null) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{info.logo}</div>
          <div>
            <h3 className="text-lg">{info.name}</h3>
            {channel && (
              <p className="text-sm text-gray-600">متصل باسم: {channel.name}</p>
            )}
          </div>
        </div>
        {getStatusIcon()}
      </div>

      {channel ? (
        <>
          {/* Connected State */}
          <div className="space-y-3 mb-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">آخر مزامنة:</span>
              <span title={formatDate(channel.lastSyncAt)}>
                {getRelativeTime(channel.lastSyncAt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">تاريخ الاتصال:</span>
              <span>{formatDate(channel.connectedAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">الحالة:</span>
              <span className={`px-2 py-1 rounded-full text-xs ${
                channel.status === 'CONNECTED'
                  ? 'bg-green-100 text-green-700'
                  : channel.status === 'ERROR'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {channel.status === 'CONNECTED' ? 'متصل' : channel.status === 'ERROR' ? 'خطأ' : 'غير متصل'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {isSyncing ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>مزامنة</span>
            </button>
            <button
              onClick={() => onDisconnect(channel)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              title="قطع الاتصال"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Disconnected State */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            {provider === 'SHOPIFY'
              ? 'قم بتوصيل متجر Shopify الخاص بك لبدء مزامنة الطلبات تلقائياً'
              : 'قم بتوصيل متجر WooCommerce الخاص بك لبدء مزامنة الطلبات تلقائياً'}
          </div>

          <button
            onClick={provider === 'SHOPIFY' ? handleConnectShopify : onConnectWoo}
            disabled={isCreatingOAuth}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreatingOAuth ? (
              <Spinner size="sm" />
            ) : (
              <ShoppingBag className="w-4 h-4" />
            )}
            <span>توصيل {info.name}</span>
          </button>
        </>
      )}
    </div>
  );
}
