import type { EventFunding, EventProgress, InvitationPreview, InvitationStatus, MemberRole, VoteVisibility } from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './auth';
import { supabase, unwrap } from './supabase';
import type { ActivityRow, EventRow, InvitationRow, MemberRow, NotificationPrefs, NotificationRow, Profile } from './types';

export const qk = {
  myEvents: ['my-events'] as const,
  event: (id: string) => ['event', id] as const,
  members: (id: string) => ['event', id, 'members'] as const,
  progress: (id: string) => ['event', id, 'progress'] as const,
  funding: (id: string) => ['event', id, 'funding'] as const,
  activity: (id: string) => ['event', id, 'activity'] as const,
  invitations: (id: string) => ['event', id, 'invitations'] as const,
  profile: ['profile'] as const,
  prefs: ['prefs'] as const,
  notifications: ['notifications'] as const,
};

// ------------------------------------------------------------------ événements
export type MyEvent = { role: MemberRole; event: EventRow };

export function useMyEvents() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.myEvents,
    enabled: !!session,
    queryFn: async (): Promise<MyEvent[]> => {
      const rows = unwrap(
        await supabase
          .from('event_members')
          .select('role, events(*)')
          .eq('user_id', session!.user.id)
          .eq('status', 'active'),
      ) as unknown as { role: MemberRole; events: EventRow | null }[];
      // Un bénéficiaire ne reçoit l'événement qu'après le dévoilement (RLS) : on ignore les lignes vides.
      return rows
        .filter((r) => r.events)
        .map((r) => ({ role: r.role, event: r.events! }))
        .sort((a, b) => a.event.gift_at.localeCompare(b.event.gift_at));
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: qk.event(id),
    queryFn: async () => unwrap(await supabase.from('events').select('*').eq('id', id).maybeSingle()) as EventRow | null,
  });
}

export function useMembers(id: string) {
  return useQuery({
    queryKey: qk.members(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('event_members')
          .select('event_id, user_id, role, status, joined_at, profiles(display_name, avatar_path)')
          .eq('event_id', id)
          .eq('status', 'active')
          .order('joined_at'),
      ) as unknown as MemberRow[],
  });
}

export function useProgress(id: string) {
  return useQuery({
    queryKey: qk.progress(id),
    queryFn: async () => unwrap(await supabase.rpc('event_progress', { p_event: id })) as EventProgress | null,
  });
}

export function useFunding(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.funding(id),
    enabled,
    queryFn: async () => unwrap(await supabase.rpc('event_funding', { p_event: id })) as EventFunding | null,
  });
}

export function useActivity(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.activity(id),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('activity')
          .select('id, event_id, actor_id, kind, data, created_at, profiles(display_name)')
          .eq('event_id', id)
          .order('created_at', { ascending: false })
          .limit(15),
      ) as unknown as ActivityRow[],
  });
}

/** Actualisation en temps réel : chaque changement autorisé par la RLS invalide le cache concerné. */
export function useEventRealtime(id: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`event:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: qk.event(id) });
        qc.invalidateQueries({ queryKey: qk.funding(id) });
        qc.invalidateQueries({ queryKey: qk.progress(id) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_members', filter: `event_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: qk.members(id) });
        qc.invalidateQueries({ queryKey: qk.progress(id) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `event_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: qk.activity(id) });
        qc.invalidateQueries({ queryKey: qk.progress(id) });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);
}

export type CreateEventInput = {
  title: string;
  beneficiaryName: string;
  occasion: string;
  description: string;
  targetCents: number;
  giftAt: Date;
  votesCloseAt: Date;
  contributionsCloseAt: Date;
  revealAt: Date;
  timezone: string;
  voteVisibility: VoteVisibility;
  coverPath?: string | null;
};

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: CreateEventInput) =>
      unwrap(
        await supabase.rpc('create_event', {
          p_title: i.title,
          p_beneficiary_name: i.beneficiaryName,
          p_occasion: i.occasion,
          p_description: i.description,
          p_target_cents: i.targetCents,
          p_gift_at: i.giftAt.toISOString(),
          p_votes_close_at: i.votesCloseAt.toISOString(),
          p_contributions_close_at: i.contributionsCloseAt.toISOString(),
          p_reveal_at: i.revealAt.toISOString(),
          p_timezone: i.timezone,
          p_vote_visibility: i.voteVisibility,
          p_cover_path: i.coverPath ?? null,
        }),
      ) as string,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myEvents }),
  });
}

export type EventSettingsPatch = Partial<
  Pick<EventRow, 'title' | 'beneficiary_name' | 'occasion' | 'description' | 'target_cents' | 'gift_at' | 'votes_close_at' | 'contributions_close_at' | 'reveal_at' | 'vote_visibility'>
>;

export function useUpdateEvent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: EventSettingsPatch) => {
      const rows = unwrap(await supabase.from('events').update(patch).eq('id', id).select('id'));
      if (!rows || rows.length === 0) throw new Error('forbidden');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.event(id) });
      qc.invalidateQueries({ queryKey: qk.progress(id) });
      qc.invalidateQueries({ queryKey: qk.myEvents });
    },
  });
}

// ------------------------------------------------------------------ invitations et membres
export function useInvitations(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.invitations(id),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('invitations')
          .select('id, event_id, role, expires_at, revoked_at, max_uses, use_count, created_at')
          .eq('event_id', id)
          .order('created_at', { ascending: false }),
      ) as InvitationRow[],
  });
}

export function useCreateInvitation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { role: MemberRole; hours: number; maxUses: number | null }) =>
      unwrap(
        await supabase.rpc('create_invitation', { p_event: id, p_role: v.role, p_expires_in_hours: v.hours, p_max_uses: v.maxUses }),
      ) as { id: string; token: string; expires_at: string; role: MemberRole },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(id) }),
  });
}

export function useRevokeInvitation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => unwrap(await supabase.rpc('revoke_invitation', { p_invitation: invitationId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invitations(id) }),
  });
}

export function useInvitationPreview(token: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['invitation', token, session?.user.id ?? 'anon'],
    enabled: !!token,
    queryFn: async () => unwrap(await supabase.rpc('preview_invitation', { p_token: token })) as InvitationPreview,
  });
}

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) =>
      unwrap(await supabase.rpc('accept_invitation', { p_token: token })) as { status: InvitationStatus; event_id?: string; role?: MemberRole },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myEvents }),
  });
}

function useMemberMutation<V>(id: string, fn: (v: V) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => unwrap(await fn(v)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(id) });
      qc.invalidateQueries({ queryKey: qk.progress(id) });
      qc.invalidateQueries({ queryKey: qk.myEvents });
    },
  });
}

export const useSetMemberRole = (id: string) =>
  useMemberMutation(id, (v: { userId: string; role: MemberRole }) => supabase.rpc('set_member_role', { p_event: id, p_user: v.userId, p_role: v.role }));
export const useRemoveMember = (id: string) =>
  useMemberMutation(id, (userId: string) => supabase.rpc('remove_member', { p_event: id, p_user: userId }));
export const useTransferOwnership = (id: string) =>
  useMemberMutation(id, (userId: string) => supabase.rpc('transfer_ownership', { p_event: id, p_user: userId }));
export const useLeaveEvent = (id: string) => useMemberMutation(id, () => supabase.rpc('leave_event', { p_event: id }));

// ------------------------------------------------------------------ profil, préférences, notifications
export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.profile,
    enabled: !!session,
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('id, display_name, avatar_path').eq('id', session!.user.id).single()) as Profile,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'avatar_path'>>) =>
      unwrap(await supabase.from('profiles').update(patch).eq('id', session!.user.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile }),
  });
}

export function usePrefs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.prefs,
    enabled: !!session,
    queryFn: async () => unwrap(await supabase.from('notification_prefs').select('*').single()) as NotificationPrefs,
  });
}

export function useUpdatePrefs() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<NotificationPrefs, 'user_id'>>) =>
      unwrap(await supabase.from('notification_prefs').update(patch).eq('user_id', session!.user.id)),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.prefs });
      const prev = qc.getQueryData<NotificationPrefs>(qk.prefs);
      if (prev) qc.setQueryData(qk.prefs, { ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(qk.prefs, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.prefs }),
  });
}

export function useNotifications() {
  const { session } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, () =>
        qc.invalidateQueries({ queryKey: qk.notifications }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, qc]);
  return useQuery({
    queryKey: qk.notifications,
    enabled: !!session,
    queryFn: async () =>
      unwrap(
        await supabase.from('notifications').select('id, event_id, kind, data, read_at, created_at').order('created_at', { ascending: false }).limit(50),
      ) as NotificationRow[],
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[] | null) => unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids })),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  });
}
