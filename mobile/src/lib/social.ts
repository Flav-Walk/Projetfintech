import type {
  BlockedRow,
  FriendRequestStatus,
  FriendRow,
  InviteFriendStatus,
  InviteOverviewRow,
  MemberRole,
  ProfileSearchRow,
  ReceivedInvite,
  SurpriseRow,
} from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { qk } from './queries';
import { supabase, unwrap } from './supabase';

export const sk = {
  friends: ['social', 'friends'] as const,
  blocked: ['social', 'blocked'] as const,
  search: (q: string) => ['social', 'search', q] as const,
  received: ['social', 'received-invites'] as const,
  surprises: ['social', 'surprises'] as const,
  overview: (eventId: string) => ['event', eventId, 'invites-overview'] as const,
};

// ------------------------------------------------------------------ amis
export function useFriends() {
  const { session } = useAuth();
  return useQuery({
    queryKey: sk.friends,
    enabled: !!session,
    queryFn: async () => (unwrap(await supabase.rpc('my_friends')) ?? []) as FriendRow[],
  });
}

export function useBlocked(enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: sk.blocked,
    enabled: !!session && enabled,
    queryFn: async () => (unwrap(await supabase.rpc('my_blocked')) ?? []) as BlockedRow[],
  });
}

/** Valeur différée : évite une requête par frappe. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function normalizeQuery(q: string) {
  return q.trim().replace(/^@+/, '').toLowerCase();
}

export function useProfileSearch(raw: string) {
  const q = useDebounced(normalizeQuery(raw));
  return useQuery({
    queryKey: sk.search(q),
    enabled: q.length >= 2 && /^[a-z0-9_.]+$/.test(q),
    staleTime: 10_000,
    queryFn: async () => (unwrap(await supabase.rpc('search_profiles', { p_query: q })) ?? []) as ProfileSearchRow[],
  });
}

function useSocialMutation<V, R>(fn: (v: V) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => unwrap(await fn(v)) as R,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['social'] });
      qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
}

export const useSendFriendRequest = () =>
  useSocialMutation<string, { status: FriendRequestStatus }>((id) => supabase.rpc('send_friend_request', { p_user: id }));
export const useRespondFriendRequest = () =>
  useSocialMutation<{ id: string; accept: boolean }, { status: string }>((v) => supabase.rpc('respond_friend_request', { p_user: v.id, p_accept: v.accept }));
export const useCancelFriendRequest = () => useSocialMutation<string, null>((id) => supabase.rpc('cancel_friend_request', { p_user: id }));
export const useRemoveFriend = () => useSocialMutation<string, null>((id) => supabase.rpc('remove_friend', { p_user: id }));
export const useBlockUser = () => useSocialMutation<string, null>((id) => supabase.rpc('block_user', { p_user: id }));
export const useUnblockUser = () => useSocialMutation<string, null>((id) => supabase.rpc('unblock_user', { p_user: id }));

// ------------------------------------------------------------------ invitations reçues
export function useReceivedInvites() {
  const { session } = useAuth();
  return useQuery({
    queryKey: sk.received,
    enabled: !!session,
    queryFn: async () => (unwrap(await supabase.rpc('my_event_invites')) ?? []) as ReceivedInvite[],
  });
}

export function useRespondInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; accept: boolean }) =>
      unwrap(await supabase.rpc('respond_event_invite', { p_invite: v.id, p_accept: v.accept })) as { status: string; event_id?: string; role?: MemberRole },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sk.received });
      qc.invalidateQueries({ queryKey: sk.surprises });
      qc.invalidateQueries({ queryKey: qk.myEvents });
      qc.invalidateQueries({ queryKey: qk.myFunding });
      qc.invalidateQueries({ queryKey: qk.notifications });
    },
  });
}

/** Bénéficiaire avant l'ouverture : date et organisateur seulement. */
export function useSurprises() {
  const { session } = useAuth();
  return useQuery({
    queryKey: sk.surprises,
    enabled: !!session,
    queryFn: async () => (unwrap(await supabase.rpc('my_surprises')) ?? []) as SurpriseRow[],
  });
}

/**
 * Invitations par e-mail adressées à mon adresse vérifiée : rattachées à mon compte à la connexion
 * et au retour au premier plan (idempotent côté base).
 */
export function useClaimEmailInvites() {
  const { session } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const run = () =>
      supabase.rpc('claim_email_invites').then(({ data }) => {
        if (alive && typeof data === 'number' && data > 0) {
          qc.invalidateQueries({ queryKey: sk.received });
          qc.invalidateQueries({ queryKey: qk.notifications });
        }
      });
    void run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => {
      alive = false;
      sub.remove();
    };
  }, [session, qc]);
}

/** Temps réel : demandes d'ami et invitations reçues, filtrées par la RLS. */
export function useSocialRealtime() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const instance = useId();
  useEffect(() => {
    if (!session) return;
    const me = session.user.id;
    const refresh = () => qc.invalidateQueries({ queryKey: ['social'] });
    const channel = supabase
      .channel(`social:${me}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_low=eq.${me}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `user_high=eq.${me}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_invites', filter: `invitee_id=eq.${me}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, qc, instance]);
}

// ------------------------------------------------------------------ inviter dans une cagnotte
export function useInvitesOverview(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: sk.overview(eventId),
    enabled,
    queryFn: async () => (unwrap(await supabase.rpc('event_invites_overview', { p_event: eventId })) ?? []) as InviteOverviewRow[],
  });
}

export function useInviteFriends(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { users: string[]; role: MemberRole }) =>
      unwrap(await supabase.rpc('invite_friends', { p_event: eventId, p_users: v.users, p_role: v.role })) as { user_id: string; status: InviteFriendStatus }[],
    onSettled: () => qc.invalidateQueries({ queryKey: sk.overview(eventId) }),
  });
}

export function useCancelInvite(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; kind: 'friend' | 'email'; attached: boolean }) =>
      unwrap(
        v.kind === 'email' && !v.attached
          ? await supabase.rpc('cancel_email_invitation', { p_invitation: v.id })
          : await supabase.rpc('cancel_event_invite', { p_invite: v.id }),
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sk.overview(eventId) });
      qc.invalidateQueries({ queryKey: qk.invitations(eventId) });
    },
  });
}

/** Renvoyer une invitation (ami : nouvelle invitation ; e-mail : nouveau lien, l'ancien est révoqué). */
export function useResendInvite(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('resend_event_invitation', { p_id: id })) as { status: string },
    onSettled: () => qc.invalidateQueries({ queryKey: sk.overview(eventId) }),
  });
}

// ------------------------------------------------------------------ pseudo
export function useUsernameAvailable(raw: string, current: string | undefined) {
  const q = useDebounced(normalizeQuery(raw), 350);
  return useQuery({
    queryKey: ['social', 'username-available', q],
    enabled: q.length >= 3 && q !== current,
    staleTime: 5_000,
    queryFn: async () => unwrap(await supabase.rpc('username_available', { p_username: q })) as boolean,
  });
}

export function useSetUsername() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (u: string) => unwrap(await supabase.rpc('set_username', { p_username: u })) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
