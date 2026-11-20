import type { ContributionResponse } from '@complice/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { api } from './api';
import { qk } from './queries';

export const contributionKeys = { mine: (id: string) => ['event', id, 'my-contributions'] as const };

export function useMyContributions(eventId: string) {
  return useQuery({
    queryKey: contributionKeys.mine(eventId),
    queryFn: async () => (await api.myContributions(eventId)).contributions,
  });
}

/** Tentative en cours, conservée jusqu'à une issue connue (survit à une fermeture de l'app). */
export type Attempt = { key: string; amount_cents: number };
const attemptKey = (eventId: string) => `complice.contribution.${eventId}`;

export async function loadAttempt(eventId: string): Promise<Attempt | null> {
  try {
    const raw = await AsyncStorage.getItem(attemptKey(eventId));
    return raw ? (JSON.parse(raw) as Attempt) : null;
  } catch {
    return null;
  }
}

export async function saveAttempt(eventId: string, a: Attempt | null) {
  try {
    if (a) await AsyncStorage.setItem(attemptKey(eventId), JSON.stringify(a));
    else await AsyncStorage.removeItem(attemptKey(eventId));
  } catch {
    // stockage local indisponible : l'idempotence serveur reste garantie pendant la session
  }
}

export function newAttempt(amount_cents: number): Attempt {
  return { key: Crypto.randomUUID(), amount_cents };
}

/**
 * Envoi idempotent : la même clé renvoie la même contribution (double appui, reprise réseau,
 * requête rejouée). Une clé n'est abandonnée qu'après une issue connue (confirmée ou refusée).
 */
export function useContribute(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ attempt, simulate }: { attempt: Attempt; simulate?: 'failure' }): Promise<ContributionResponse> => {
      await saveAttempt(eventId, attempt);
      const res = await api.createContribution({ event_id: eventId, amount_cents: attempt.amount_cents, idempotency_key: attempt.key, simulate });
      if (res.status === 'confirmed' || res.status === 'failed') await saveAttempt(eventId, null);
      return res;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: contributionKeys.mine(eventId) });
      qc.invalidateQueries({ queryKey: qk.funding(eventId) });
      qc.invalidateQueries({ queryKey: qk.progress(eventId) });
      qc.invalidateQueries({ queryKey: qk.event(eventId) });
      qc.invalidateQueries({ queryKey: ['event', eventId, 'badges'] });
    },
  });
}
