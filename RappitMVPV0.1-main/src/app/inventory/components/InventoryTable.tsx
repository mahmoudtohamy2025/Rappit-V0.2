'use client';

import { useState } from 'react';
import { AlertTriangle, Edit } from 'lucide-react';
import { InventorySku } from '@/lib/types/inventory';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/UI/Table';
import { AdjustStockModal } from './AdjustStockModal';

interface InventoryTableProps {
  items: InventorySku[];
}

export function InventoryTable({ items }: InventoryTableProps) {
  const [selectedSku, setSelectedSku] = useState<InventorySku | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const handleAdjustClick = (sku: InventorySku) => {
    setSelectedSku(sku);
    setShowAdjustModal(true);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <tr>
            <TableHead>إجراءات</TableHead>
            <TableHead>آخر تحديث</TableHead>
            <TableHead>الموقع</TableHead>
            <TableHead>المتاح</TableHead>
            <TableHead>المحجوز</TableHead>
            <TableHead>الموجود</TableHead>
            <TableHead>اسم المنتج</TableHead>
            <TableHead>SKU</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const available = item.quantityOnHand - item.reserved;
            const isLowStock =
              item.lowStockThreshold && available <= item.lowStockThreshold;

            return (
              <TableRow key={item.skuId}>
                <TableCell>
                  <button
                    onClick={() => handleAdjustClick(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="تعديل المخزون"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </TableCell>

                <TableCell className="text-sm text-gray-600">
                  {formatDate(item.lastUpdated)}
                </TableCell>

                <TableCell className="text-sm">{item.location || '-'}</TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={isLowStock ? 'text-red-600' : 'text-green-600'}>
                      {available}
                    </span>
                    {isLowStock && (
                      <div className="group relative">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          مخزون منخفض (الحد: {item.lowStockThreshold})
                        </div>
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {item.reserved}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="text-gray-900">{item.quantityOnHand}</span>
                </TableCell>

                <TableCell>{item.name}</TableCell>

                <TableCell>
                  <span className="font-mono text-sm">{item.sku}</span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selectedSku && (
        <AdjustStockModal
          sku={selectedSku}
          isOpen={showAdjustModal}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedSku(null);
          }}
        />
      )}
    </>
  );
}
