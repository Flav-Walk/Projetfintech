import type { MemberRole } from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { clockOffset, remainingMs } from './countdown';
import { supabase, unwrap } from './supabase';

export { countdownParts } from './countdown';

/**
 * Espace de la personne fêtée : l'état de sa capsule vient du serveur (heure serveur comprise).
 * Le compte à rebours est corrigé du décalage d'horloge du téléphone ; l'autorisation de lire les mots et
 * les photos reste décidée par la base (is_revealed, RLS, URL signées) : changer l'heure du téléphone,
 * l'URL ou appeler l'API directement ne donne rien avant l'heure.
 */
export type BeneficiaryCapsule = {
  event_id: string;
  state: 'sealed' | 'open' | 'cancelled';
  reveal_at: string;
  timezone: string;
  server_now: string;
  organizer_name: string | null;
  opened_at: string | null;
  title: string | null;
  occasion: string | null;
  cover_path: string | null;
  cover_art: string | null;
};

export const surpriseKeys = {
  capsule: (id: string) => ['surprise', id] as const,
  role: (id: string) => ['event', id, 'my-role'] as const,
};

export function useBeneficiaryCapsule(eventId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: surpriseKeys.capsule(eventId),
    retry: 1,
    queryFn: async () => {
      const data = unwrap(await supabase.rpc('beneficiary_capsule', { p_event: eventId })) as BeneficiaryCapsule | null;
      return data ? { ...data, offset: clockOffset(data.server_now, Date.now()) } : null;
    },
  });
  // Retour au premier plan : l'état est revérifié auprès du serveur.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void qc.invalidateQueries({ queryKey: surpriseKeys.capsule(eventId) });
    });
    return () => sub.remove();
  }, [eventId, qc]);
  return q;
}

/**
 * Temps restant, rafraîchi chaque seconde. À zéro, l'état est redemandé au serveur (seule autorité),
 * puis toutes les 5 s tant qu'il répond encore « scellée » (horloges légèrement décalées).
 */
export function useCountdown(eventId: string, revealAt: string | undefined, offset: number, sealed: boolean) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sealed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sealed]);
  const left = revealAt ? remainingMs(revealAt, offset, now) : Infinity;
  const due = sealed && left === 0;
  useEffect(() => {
    if (!due) return;
    void qc.invalidateQueries({ queryKey: surpriseKeys.capsule(eventId) });
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: surpriseKeys.capsule(eventId) }), 5000);
    return () => clearInterval(t);
  }, [due, eventId, qc]);
  return left;
}

export function useMarkCapsuleOpened(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('mark_capsule_opened', { p_event: eventId })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: surpriseKeys.capsule(eventId) }),
  });
}

/** Mon rôle dans une cagnotte (ma propre ligne de membre, toujours lisible). */
export function useMyRole(eventId: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: surpriseKeys.role(eventId),
    enabled: !!session,
    staleTime: 60_000,
    queryFn: async () =>
      ((unwrap(
        await supabase.from('event_members').select('role').eq('event_id', eventId).eq('user_id', session!.user.id).eq('status', 'active').maybeSingle(),
      ) as { role: MemberRole } | null)?.role ?? null),
  });
}
