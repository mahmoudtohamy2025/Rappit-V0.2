// lib/hooks/useShipping.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShippingAccounts,
  createShippingAccount,
  updateShippingAccount,
  deleteShippingAccount,
  testShippingAccount,
} from '../api/shipping';
import type {
  CreateShippingAccountPayload,
  UpdateShippingAccountPayload,
  TestConnectionPayload,
} from '../types/shipping';

export function useShippingAccounts() {
  return useQuery({
    queryKey: ['shipping-accounts'],
    queryFn: getShippingAccounts,
    staleTime: 30000,
  });
}

export function useCreateShippingAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateShippingAccountPayload) => createShippingAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-accounts'] });
    },
  });
}

export function useUpdateShippingAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateShippingAccountPayload }) =>
      updateShippingAccount(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-accounts'] });
    },
  });
}

export function useDeleteShippingAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteShippingAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-accounts'] });
    },
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: TestConnectionPayload }) =>
      testShippingAccount(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-accounts'] });
    },
  });
}
