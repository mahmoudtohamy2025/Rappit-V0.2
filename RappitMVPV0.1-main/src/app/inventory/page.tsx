'use client';

import { useState, useEffect } from 'react';
import { Search, Package, Warehouse, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import { useInventory } from '@/lib/hooks/useInventory';
import { TableSkeleton } from '@/components/UI/Spinner';
import { EmptyState } from '@/components/UI/EmptyState';
import { ErrorState } from '@/components/UI/ErrorState';
import { InventoryTable } from './components/InventoryTable';

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, error, refetch } = useInventory({
    search: debouncedSearch || undefined,
    page,
    pageSize,
  });

  // Calculate stats
  const stats = data
    ? {
        totalProducts: data.meta.total,
        totalReserved: data.data.reduce((sum, item) => sum + item.reserved, 0),
        lowStock: data.data.filter(
          (item) =>
            item.lowStockThreshold &&
            item.quantityOnHand - item.reserved <= item.lowStockThreshold
        ).length,
      }
    : null;

  const totalPages = data ? Math.ceil(data.meta.total / data.meta.pageSize) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl mb-2">إدارة المخزون</h1>
        <p className="text-gray-600">نموذج C - الحجز التلقائي عند الاستيراد</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">إجمالي المنتجات</p>
              <p className="text-2xl">{stats.totalProducts}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Warehouse className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">المحجوزة (Model C)</p>
              <p className="text-2xl">{stats.totalReserved}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-orange-100">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">منخفض المخزون</p>
              <p className="text-2xl">{stats.lowStock}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">معدل الدوران</p>
              <p className="text-2xl">2.4x</p>
            </div>
          </div>
        </div>
      )}

      {/* Model C Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg mb-3 text-blue-900">نموذج C للحجز التلقائي</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>✓ يتم حجز المخزون تلقائياً عند استيراد الطلب</p>
          <p>✓ يتم إطلاق المخزون عند إلغاء الطلب أو إرجاعه</p>
          <p>✓ يضمن عدم البيع الزائد (Overselling)</p>
          <p>✓ تتبع دقيق للمخزون المتاح والمحجوز</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بـ SKU أو اسم المنتج..."
            className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          <span>تصدير CSV</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading && (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {Array.from({ length: 8 }).map((_, i) => (
                  <th key={i} className="px-6 py-3 text-right text-sm text-gray-600">
                    <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={pageSize} />
            </tbody>
          </table>
        )}

        {error && (
          <ErrorState
            message={error instanceof Error ? error.message : 'فشل تحميل المخزون'}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !error && data && data.data.length === 0 && (
          <EmptyState
            title="لا توجد منتجات"
            description="لم يتم العثور على منتجات تطابق المعايير المحددة"
          />
        )}

        {!isLoading && !error && data && data.data.length > 0 && (
          <InventoryTable items={data.data} />
        )}

        {/* Pagination */}
        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              عرض {(page - 1) * pageSize + 1} إلى {Math.min(page * pageSize, data.meta.total)} من{' '}
              {data.meta.total} منتج
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
