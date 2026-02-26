/**
 * useCapturePolicyQueries — Gestion des capture policies.
 *
 * Le routeur captures tRPC n'a pas d'endpoints spécifiques pour les policies.
 * On utilise un cache local en mémoire synchronisé avec les sources de capture
 * comme solution transitoire. Les policies sont stockées côté client pour l'instant
 * et seront migrées vers un endpoint tRPC dédié ultérieurement.
 */

import { useState, useCallback, useEffect } from 'react';
import type { CapturePolicy } from '../capture/types';

// In-memory policy store (replaces localStorage)
const policyStore = new Map<string, CapturePolicy>();

function getPolicyKey(scope: string, scopeId: string): string {
  return `${scope}:${scopeId}`;
}

/**
 * Hook pour récupérer une capture policy par scope/scopeId.
 * Compatible avec l'API de localCapturePolicies.get()
 */
export function useCapturePolicy(scope: string, scopeId: string) {
  const key = getPolicyKey(scope, scopeId);
  const [policy, setPolicy] = useState<CapturePolicy | null>(
    policyStore.get(key) ?? null,
  );

  return {
    data: policy,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook pour upsert une capture policy.
 * Compatible avec localCapturePolicies.upsert()
 */
export function useUpsertCapturePolicy() {
  const upsert = useCallback((scope: string, scopeId: string, policy: CapturePolicy) => {
    const key = getPolicyKey(scope, scopeId);
    policyStore.set(key, policy);
  }, []);

  return { mutate: upsert, isPending: false };
}

/**
 * Hook pour supprimer une capture policy.
 * Compatible avec localCapturePolicies.remove()
 */
export function useDeleteCapturePolicy() {
  const remove = useCallback((scope: string, scopeId: string) => {
    const key = getPolicyKey(scope, scopeId);
    policyStore.delete(key);
  }, []);

  return { mutate: remove, isPending: false };
}

/**
 * Fonctions synchrones pour compatibilité avec les composants existants
 * qui utilisent localCapturePolicies.get/upsert/remove directement.
 */
export const capturePoliciesSync = {
  get(scope: string, scopeId: string): CapturePolicy | null {
    return policyStore.get(getPolicyKey(scope, scopeId)) ?? null;
  },
  upsert(scope: string, scopeId: string, policy: CapturePolicy): void {
    policyStore.set(getPolicyKey(scope, scopeId), policy);
  },
  remove(scope: string, scopeId: string): void {
    policyStore.delete(getPolicyKey(scope, scopeId));
  },
};
