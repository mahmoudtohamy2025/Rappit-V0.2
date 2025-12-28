// lib/hooks/useOrder.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchOrderById,
  createShipment,
  CreateShipmentPayload
} from '../api/orders';

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrderById(id),
    enabled: !!id,
    staleTime: 10000, // 10 seconds
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      payload,
      idempotencyKey
    }: {
      orderId: string;
      payload: CreateShipmentPayload;
      idempotencyKey?: string;
    }) => createShipment(orderId, payload, idempotencyKey),
    onSuccess: (_, variables) => {
      // Invalidate the order to refresh timeline and items
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
