'use client';

import { OrderTimelineEvent } from '@/lib/types/orders';
import { Clock, User, Package, Truck, XCircle, CheckCircle } from 'lucide-react';

interface OrderTimelineProps {
  timeline: OrderTimelineEvent[];
}

export function OrderTimeline({ timeline }: OrderTimelineProps) {
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getEventIcon = (event: string) => {
    const eventUpper = event.toUpperCase();
    switch (eventUpper) {
      case 'IMPORT':
      case 'CREATED':
        return <Package className="w-5 h-5" />;
      case 'SHIPPED':
      case 'SHIPMENT_CREATED':
        return <Truck className="w-5 h-5" />;
      case 'CANCELLED':
        return <XCircle className="w-5 h-5" />;
      case 'DELIVERED':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getEventColor = (event: string) => {
    const eventUpper = event.toUpperCase();
    if (eventUpper.includes('CANCEL')) return 'text-red-600 bg-red-100';
    if (eventUpper.includes('DELIVER')) return 'text-green-600 bg-green-100';
    if (eventUpper.includes('SHIP')) return 'text-blue-600 bg-blue-100';
    return 'text-gray-600 bg-gray-100';
  };

  // Sort timeline in reverse chronological order
  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl mb-6">التسلسل الزمني</h2>

      <div className="space-y-4">
        {sortedTimeline.map((event, index) => (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`p-2 rounded-full ${getEventColor(event.event)}`}>
                {getEventIcon(event.event)}
              </div>
              {index < sortedTimeline.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-2 min-h-[40px]" />
              )}
            </div>

            <div className="flex-1 pb-6">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-medium">{event.event}</h3>
                <span className="text-sm text-gray-500">{formatDate(event.createdAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <User className="w-4 h-4" />
                <span>{event.actor}</span>
              </div>

              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <pre className="text-xs text-gray-600 overflow-x-auto">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {sortedTimeline.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>لا توجد أحداث بعد</p>
        </div>
      )}
    </div>
  );
}
