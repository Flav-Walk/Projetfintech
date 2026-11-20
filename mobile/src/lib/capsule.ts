import type { CapsuleStats, CapsuleStatus } from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { qk } from './queries';
import { supabase, unwrap } from './supabase';
import type { BadgeRow, CapsuleEntryRow } from './types';

export const capsuleKeys = {
  mine: (id: string) => ['event', id, 'capsule', 'mine'] as const,
  all: (id: string) => ['event', id, 'capsule', 'all'] as const,
  stats: (id: string) => ['event', id, 'capsule', 'stats'] as const,
  badges: (id: string) => ['event', id, 'badges'] as const,
};

const COLS = 'id, event_id, author_id, body, photo_path, status, published_at, updated_at, profiles(display_name)';

/** Mon mot (brouillon ou publié) : seul l'auteur le voit avant l'ouverture (RLS). */
export function useMyEntry(eventId: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: capsuleKeys.mine(eventId),
    enabled: enabled && !!session,
    queryFn: async () =>
      (unwrap(
        await supabase.from('capsule_entries').select(COLS).eq('event_id', eventId).eq('author_id', session!.user.id).maybeSingle(),
      ) as unknown as CapsuleEntryRow | null) ?? null,
  });
}

/** Mots publiés, lisibles par le groupe et le bénéficiaire seulement après l'ouverture (RLS). */
export function useCapsuleEntries(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: capsuleKeys.all(eventId),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase.from('capsule_entries').select(COLS).eq('event_id', eventId).eq('status', 'published').order('published_at'),
      ) as unknown as CapsuleEntryRow[],
  });
}

export function useCapsuleStats(eventId: string) {
  return useQuery({
    queryKey: capsuleKeys.stats(eventId),
    queryFn: async () => unwrap(await supabase.rpc('capsule_stats', { p_event: eventId })) as CapsuleStats | null,
  });
}

export function useSaveEntry(eventId: string) {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (v: { id: string | null; body: string | null; photo_path: string | null; status: CapsuleStatus }) => {
      const patch = { body: v.body, photo_path: v.photo_path, status: v.status };
      if (v.id) {
        const rows = unwrap(await supabase.from('capsule_entries').update(patch).eq('id', v.id).select('id'));
        if (!rows || rows.length === 0) throw new Error('forbidden');
      } else {
        unwrap(await supabase.from('capsule_entries').insert({ ...patch, event_id: eventId, author_id: session!.user.id }));
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: capsuleKeys.mine(eventId) });
      qc.invalidateQueries({ queryKey: capsuleKeys.stats(eventId) });
      qc.invalidateQueries({ queryKey: capsuleKeys.badges(eventId) });
      qc.invalidateQueries({ queryKey: qk.progress(eventId) });
    },
  });
}

export function useDeleteEntry(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: CapsuleEntryRow) => {
      unwrap(await supabase.from('capsule_entries').delete().eq('id', entry.id));
      if (entry.photo_path) await supabase.storage.from('event-media').remove([entry.photo_path]);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: capsuleKeys.mine(eventId) });
      qc.invalidateQueries({ queryKey: capsuleKeys.stats(eventId) });
      qc.invalidateQueries({ queryKey: qk.progress(eventId) });
    },
  });
}

/** Timbres de l'événement (les miens, et ceux du groupe pour les préparateurs). */
export function useBadges(eventId: string, enabled = true) {
  return useQuery({
    queryKey: capsuleKeys.badges(eventId),
    enabled,
    queryFn: async () => unwrap(await supabase.from('user_badges').select('event_id, user_id, badge, awarded_at').eq('event_id', eventId)) as BadgeRow[],
  });
}
