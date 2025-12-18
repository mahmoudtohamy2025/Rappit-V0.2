// lib/hooks/useChannels.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getChannels,
  createShopifyOAuthSession,
  createWooCommerceConnection,
  deleteChannel,
  syncChannel,
} from '../api/channels';
import type { CreateWooCommercePayload } from '../types/channels';

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: getChannels,
    staleTime: 30000,
  });
}

export function useCreateShopifyOAuth() {
  return useMutation({
    mutationFn: (returnTo?: string) => createShopifyOAuthSession(returnTo),
  });
}

export function useCreateWooConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWooCommercePayload) => createWooCommerceConnection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useSyncChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => syncChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
