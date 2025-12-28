'use client';

import { OrderItem } from '@/lib/types/orders';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/UI/Table';

interface OrderItemsProps {
  items: OrderItem[];
  currency: string;
}

export function OrderItems({ items, currency }: OrderItemsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency || 'SAR',
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl">منتجات الطلب</h2>
      </div>

      <Table>
        <TableHeader>
          <tr>
            <TableHead>المجموع</TableHead>
            <TableHead>السعر</TableHead>
            <TableHead>الكمية المشحونة</TableHead>
            <TableHead>الكمية</TableHead>
            <TableHead>اسم المنتج</TableHead>
            <TableHead>SKU</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={`${item.skuId}-${index}`}>
              <TableCell>
                {formatCurrency(item.price * item.quantity)}
              </TableCell>
              <TableCell>{formatCurrency(item.price)}</TableCell>
              <TableCell>
                <span className="text-gray-600">
                  {item.shippedQuantity || 0}
                </span>
              </TableCell>
              <TableCell>{item.quantity}</TableCell>
              <TableCell>{item.name}</TableCell>
              <TableCell>
                <span className="font-mono text-sm">{item.skuId}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-lg">المجموع الكلي</span>
          <span className="text-2xl">
            {formatCurrency(
              items.reduce((sum, item) => sum + item.price * item.quantity, 0)
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
