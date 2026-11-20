import type { ProposalStatus } from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { qk } from './queries';
import { supabase, unwrap } from './supabase';
import type { CommentRow, ProposalRow, RankingRow, ReactionRow } from './types';

export const ideasKeys = {
  proposals: (id: string) => ['event', id, 'proposals'] as const,
  ranking: (id: string) => ['event', id, 'ranking'] as const,
  myVote: (id: string) => ['event', id, 'my-vote'] as const,
  reactions: (id: string) => ['event', id, 'reactions'] as const,
  comments: (pid: string) => ['proposal', pid, 'comments'] as const,
};

const PROPOSAL_COLUMNS =
  'id, event_id, author_id, title, price_cents, previous_price_cents, price_changed_at, product_url, description, image_path, status, vote_count, created_at, profiles(display_name)';

/** Propositions visibles (RLS : préparateurs ; bénéficiaire = seulement le cadeau retenu, après ouverture). */
export function useProposals(eventId: string) {
  return useQuery({
    queryKey: ideasKeys.proposals(eventId),
    queryFn: async () =>
      unwrap(
        await supabase.from('proposals').select(PROPOSAL_COLUMNS).eq('event_id', eventId).order('created_at', { ascending: true }),
      ) as unknown as ProposalRow[],
  });
}

export function useRanking(eventId: string, enabled = true) {
  return useQuery({
    queryKey: ideasKeys.ranking(eventId),
    enabled,
    queryFn: async () => (unwrap(await supabase.rpc('proposal_ranking', { p_event: eventId })) ?? []) as RankingRow[],
  });
}

export function useMyVote(eventId: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ideasKeys.myVote(eventId),
    enabled: enabled && !!session,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('votes').select('proposal_id').eq('event_id', eventId).eq('user_id', session!.user.id),
      ) as { proposal_id: string }[];
      return rows[0]?.proposal_id ?? null;
    },
  });
}

export function useReactions(eventId: string, proposalIds: string[]) {
  return useQuery({
    queryKey: [...ideasKeys.reactions(eventId), proposalIds.join(',')],
    enabled: proposalIds.length > 0,
    queryFn: async () =>
      unwrap(await supabase.from('proposal_reactions').select('proposal_id, user_id, emoji').in('proposal_id', proposalIds)) as ReactionRow[],
  });
}

export function useComments(proposalId: string) {
  return useQuery({
    queryKey: ideasKeys.comments(proposalId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('proposal_comments')
          .select('id, proposal_id, author_id, body, created_at, profiles(display_name)')
          .eq('proposal_id', proposalId)
          .order('created_at', { ascending: true })
          .limit(200),
      ) as unknown as CommentRow[],
  });
}

/** Résultats en direct : vote_count change sur proposals à chaque voix (publication Realtime). */
export function useIdeasRealtime(eventId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`ideas:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ideasKeys.proposals(eventId) });
        qc.invalidateQueries({ queryKey: ideasKeys.ranking(eventId) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);
}

function useInvalidateIdeas(eventId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ideasKeys.proposals(eventId) });
    qc.invalidateQueries({ queryKey: ideasKeys.ranking(eventId) });
    qc.invalidateQueries({ queryKey: ideasKeys.myVote(eventId) });
    qc.invalidateQueries({ queryKey: qk.progress(eventId) });
    qc.invalidateQueries({ queryKey: qk.event(eventId) });
  };
}

export type ProposalInput = {
  title: string;
  price_cents: number;
  product_url: string | null;
  description: string | null;
  image_path: string | null;
};

export function useSaveProposal(eventId: string) {
  const invalidate = useInvalidateIdeas(eventId);
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ProposalInput }) => {
      if (id) {
        const rows = unwrap(await supabase.from('proposals').update(input).eq('id', id).select('id'));
        if (!rows || rows.length === 0) throw new Error('forbidden');
        return id;
      }
      const row = unwrap(await supabase.from('proposals').insert({ ...input, event_id: eventId }).select('id').single()) as { id: string };
      return row.id;
    },
    onSuccess: invalidate,
  });
}

export function useSetProposalStatus(eventId: string) {
  const invalidate = useInvalidateIdeas(eventId);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProposalStatus }) => {
      const rows = unwrap(await supabase.from('proposals').update({ status }).eq('id', id).select('id'));
      if (!rows || rows.length === 0) throw new Error('forbidden');
    },
    onSuccess: invalidate,
  });
}

/** Vote avec mise à jour optimiste : l'interface répond tout de suite, la base tranche. */
export function useCastVote(eventId: string) {
  const qc = useQueryClient();
  const invalidate = useInvalidateIdeas(eventId);
  return useMutation({
    mutationFn: async (proposalId: string | null) => {
      if (proposalId) unwrap(await supabase.rpc('cast_vote', { p_proposal: proposalId }));
      else unwrap(await supabase.rpc('clear_vote', { p_event: eventId }));
    },
    onMutate: async (proposalId) => {
      await qc.cancelQueries({ queryKey: ideasKeys.myVote(eventId) });
      const prev = qc.getQueryData<string | null>(ideasKeys.myVote(eventId));
      qc.setQueryData(ideasKeys.myVote(eventId), proposalId);
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(ideasKeys.myVote(eventId), ctx?.prev ?? null),
    onSettled: invalidate,
  });
}

export function useSelectGift(eventId: string) {
  const invalidate = useInvalidateIdeas(eventId);
  return useMutation({
    mutationFn: async (proposalId: string | null) => unwrap(await supabase.rpc('select_gift', { p_event: eventId, p_proposal: proposalId })),
    onSuccess: invalidate,
  });
}

export function useToggleReaction(eventId: string) {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ proposalId, emoji, current }: { proposalId: string; emoji: string; current: string | null }) => {
      const uid = session!.user.id;
      if (current === emoji) {
        unwrap(await supabase.from('proposal_reactions').delete().eq('proposal_id', proposalId).eq('user_id', uid));
      } else {
        unwrap(await supabase.from('proposal_reactions').upsert({ proposal_id: proposalId, user_id: uid, emoji }, { onConflict: 'proposal_id,user_id' }));
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ideasKeys.reactions(eventId) }),
  });
}

export function useAddComment(proposalId: string) {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (body: string) =>
      unwrap(await supabase.from('proposal_comments').insert({ proposal_id: proposalId, body, author_id: session!.user.id })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.comments(proposalId) }),
  });
}

export function useDeleteComment(proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('proposal_comments').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ideasKeys.comments(proposalId) }),
  });
}

/** Lien produit accepté : http(s) uniquement, comme la contrainte SQL. */
export function normalizeUrl(input: string): string | null | 'invalid' {
  const v = input.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) return 'invalid';
    return withScheme.length <= 1000 ? withScheme : 'invalid';
  } catch {
    return 'invalid';
  }
}
