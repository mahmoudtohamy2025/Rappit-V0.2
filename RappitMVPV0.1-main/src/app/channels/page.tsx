'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, CheckCircle } from 'lucide-react';
import { useChannels } from '@/lib/hooks/useChannels';
import { useToast } from '@/components/UI/Toast';
import { Spinner } from '@/components/UI/Spinner';
import { ErrorState } from '@/components/UI/ErrorState';
import { ChannelCard } from './components/ChannelCard';
import { WooConnectModal } from './components/WooConnectModal';
import { DisconnectConfirm } from './components/DisconnectConfirm';
import type { Channel } from '@/lib/types/channels';

export default function ChannelsPage() {
  const [showWooModal, setShowWooModal] = useState(false);
  const [channelToDisconnect, setChannelToDisconnect] = useState<Channel | null>(null);

  const { data: channels, isLoading, error, refetch } = useChannels();
  const { showToast } = useToast();

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const mock = params.get('mock');

    if (connected === 'shopify') {
      if (mock) {
        // In mock mode, wait for channel to be added
        setTimeout(() => {
          refetch();
          showToast('تم توصيل Shopify بنجاح (وضع تجريبي)', 'success');
        }, 2500);
      } else {
        refetch();
        showToast('تم توصيل Shopify بنجاح', 'success');
      }

      // Clean up URL
      window.history.replaceState({}, '', '/channels');
    }
  }, [refetch, showToast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <ErrorState
          message={error instanceof Error ? error.message : 'فشل تحميل القنوات'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const shopifyChannel = channels?.find((ch) => ch.provider === 'SHOPIFY');
  const wooChannel = channels?.find((ch) => ch.provider === 'WOOCOMMERCE');

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl mb-2">القنوات المتصلة</h1>
        <p className="text-gray-600">إدارة اتصالات Shopify و WooCommerce</p>
      </div>

      {/* Success Banner */}
      {channels && channels.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-green-900">
              لديك {channels.length} {channels.length === 1 ? 'قناة متصلة' : 'قنوات متصلة'}
            </p>
            <p className="text-sm text-green-700">
              يتم مزامنة الطلبات تلقائياً من القنوات المتصلة
            </p>
          </div>
        </div>
      )}

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChannelCard
          channel={shopifyChannel}
          provider="SHOPIFY"
          onConnectWoo={() => {}}
          onDisconnect={(channel) => setChannelToDisconnect(channel)}
        />

        <ChannelCard
          channel={wooChannel}
          provider="WOOCOMMERCE"
          onConnectWoo={() => setShowWooModal(true)}
          onDisconnect={(channel) => setChannelToDisconnect(channel)}
        />
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg text-blue-900 mb-3 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          <span>معلومات حول القنوات</span>
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>✓ يتم استيراد الطلبات تلقائياً من القنوات المتصلة</p>
          <p>✓ يتم حجز المخزون تلقائياً عند استيراد الطلب (نموذج C)</p>
          <p>✓ يمكنك توصيل عدة متاجر من نفس القناة</p>
          <p>✓ البيانات الحساسة (API Keys) محمية ومشفرة</p>
        </div>
      </div>

      {/* Modals */}
      <WooConnectModal
        isOpen={showWooModal}
        onClose={() => setShowWooModal(false)}
      />

      <DisconnectConfirm
        channel={channelToDisconnect}
        isOpen={!!channelToDisconnect}
        onClose={() => setChannelToDisconnect(null)}
      />
    </div>
  );
}
