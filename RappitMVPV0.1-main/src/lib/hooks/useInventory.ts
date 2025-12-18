// lib/hooks/useInventory.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInventory,
  adjustStock,
  AdjustStockPayload
} from '../api/inventory';

interface UseInventoryParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useInventory(params: UseInventoryParams) {
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: () => fetchInventory(params),
    staleTime: 30000, // 30 seconds
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skuId, payload }: { skuId: string; payload: AdjustStockPayload }) =>
      adjustStock(skuId, payload),
    onSuccess: () => {
      // Invalidate the entire inventory list to refresh
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
