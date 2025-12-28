'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Download, RefreshCw } from 'lucide-react';
import { useOrders } from '@/lib/hooks/useOrders';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/UI/Table';
import { Spinner, TableSkeleton } from '@/components/UI/Spinner';
import { EmptyState } from '@/components/UI/EmptyState';
import { ErrorState } from '@/components/UI/ErrorState';
import { StatusPill } from '@/components/UI/StatusPill';
import { ORDER_STATUSES } from '@/lib/types/orders';

interface OrdersPageProps {
  onOrderClick?: (orderId: string) => void;
}

export default function OrdersPage({ onOrderClick }: OrdersPageProps) {
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, error, refetch } = useOrders({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    search: debouncedSearch || undefined,
    page,
    pageSize,
  });

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handleRowClick = (orderId: string) => {
    if (onOrderClick) {
      onOrderClick(orderId);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency || 'SAR',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const totalPages = data ? Math.ceil(data.meta.total / data.meta.pageSize) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">إدارة الطلبات</h1>
          <p className="text-gray-600">عرض وإدارة جميع الطلبات عبر القنوات</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            <span>تصدير</span>
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>مزامنة</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => handleStatusChange('all')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              selectedStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            جميع الحالات ({data?.meta.total || 0})
          </button>
          {ORDER_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              <StatusPill status={status} className="bg-transparent border-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث برقم الطلب، اسم العميل، أو البريد الإلكتروني..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          <span>تصفية</span>
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>التاريخ</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>رقم الطلب بالقناة</TableHead>
              <TableHead>رقم الطلب</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {isLoading && <TableSkeleton rows={pageSize} />}

            {error && (
              <tr>
                <td colSpan={7}>
                  <ErrorState
                    message={error instanceof Error ? error.message : 'فشل تحميل الطلبات'}
                    onRetry={() => refetch()}
                  />
                </td>
              </tr>
            )}

            {!isLoading && !error && data && data.data.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="لا توجد طلبات"
                    description="لم يتم العثور على طلبات تطابق المعايير المحددة"
                  />
                </td>
              </tr>
            )}

            {!isLoading && !error && data && data.data.map((order) => (
              <TableRow key={order.id} onClick={() => handleRowClick(order.id)}>
                <TableCell className="text-sm text-gray-600">
                  {formatDate(order.createdAt)}
                </TableCell>
                <TableCell>
                  <StatusPill status={order.status} />
                </TableCell>
                <TableCell className="text-sm">{order.paymentMethod}</TableCell>
                <TableCell>{formatCurrency(order.total, order.currency)}</TableCell>
                <TableCell>
                  <div>
                    <p>{order.customer.name}</p>
                    {order.customer.email && (
                      <p className="text-sm text-gray-500">{order.customer.email}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {order.channelOrderId}
                </TableCell>
                <TableCell>{order.id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, data.meta.total)} من{' '}
              {data.meta.total} طلب
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                السابق
              </button>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-2 rounded-lg ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
