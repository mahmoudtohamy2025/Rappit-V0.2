// lib/hooks/useOrders.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchOrders,
  updateOrderStatus,
  OrderStatusUpdatePayload
} from '../api/orders';

interface UseOrdersParams {
  status?: string;
  channel?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useOrders(params: UseOrdersParams) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => fetchOrders(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useChangeOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrderStatusUpdatePayload }) =>
      updateOrderStatus(id, payload),
    onSuccess: (_, variables) => {
      // Invalidate both the single order and the orders list
      queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
