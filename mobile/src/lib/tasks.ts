import type { ClaimResult } from '@complice/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { hapticSuccess } from './haptics';
import { qk } from './queries';
import { supabase, unwrap } from './supabase';
import type { TaskRow } from './types';

export const taskKeys = { list: (id: string) => ['event', id, 'tasks'] as const };

export function useTasks(eventId: string, enabled = true) {
  const qc = useQueryClient();
  // Nom de canal propre à chaque écran : deux onglets montés ensemble ne se coupent pas l'un l'autre.
  const instance = useId();
  useEffect(() => {
    if (!enabled) return;
    // Une prise de mission par un autre membre apparaît sans recharger.
    const channel = supabase
      .channel(`tasks:${eventId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `event_id=eq.${eventId}` }, () =>
        qc.invalidateQueries({ queryKey: taskKeys.list(eventId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc, enabled, instance]);
  return useQuery({
    queryKey: taskKeys.list(eventId),
    enabled,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('tasks')
          .select('id, event_id, title, kind, due_at, assignee_id, status, position, completed_at, assignee:profiles!tasks_assignee_id_fkey(display_name)')
          .eq('event_id', eventId)
          .order('position'),
      ) as unknown as TaskRow[],
  });
}

function useTaskMutation<V, R = unknown>(eventId: string, fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: taskKeys.list(eventId) });
      qc.invalidateQueries({ queryKey: qk.progress(eventId) });
      qc.invalidateQueries({ queryKey: ['event', eventId, 'badges'] });
    },
  });
}

export const useClaimTask = (eventId: string) =>
  useTaskMutation(eventId, async (taskId: string) => {
    const r = unwrap(await supabase.rpc('claim_task', { p_task: taskId })) as ClaimResult;
    if (r.status === 'claimed') hapticSuccess();
    return r;
  });
export const useCompleteTask = (eventId: string) =>
  useTaskMutation(eventId, async (taskId: string) => {
    unwrap(await supabase.rpc('complete_task', { p_task: taskId }));
    hapticSuccess();
  });
export const useReleaseTask = (eventId: string) =>
  useTaskMutation(eventId, async (taskId: string) => unwrap(await supabase.rpc('release_task', { p_task: taskId })));
export const useAssignTask = (eventId: string) =>
  useTaskMutation(eventId, async (v: { taskId: string; userId: string }) => unwrap(await supabase.rpc('assign_task', { p_task: v.taskId, p_user: v.userId })));
export const useCreateTask = (eventId: string) =>
  useTaskMutation(eventId, async (v: { title: string; dueAt: Date | null; assignee: string | null }) =>
    unwrap(await supabase.rpc('create_task', { p_event: eventId, p_title: v.title, p_due_at: v.dueAt?.toISOString() ?? null, p_assignee: v.assignee })),
  );
/** Titre et échéance (gestionnaires : RLS tasks_update ; colonnes autorisées : titre, échéance, ordre). */
export const useUpdateTask = (eventId: string) =>
  useTaskMutation(eventId, async (v: { taskId: string; title: string; dueAt: Date | null }) => {
    const rows = unwrap(
      await supabase.from('tasks').update({ title: v.title, due_at: v.dueAt?.toISOString() ?? null }).eq('id', v.taskId).select('id'),
    );
    if (!rows || rows.length === 0) throw new Error('forbidden');
  });
export const useDeleteTask = (eventId: string) =>
  useTaskMutation(eventId, async (taskId: string) => {
    const rows = unwrap(await supabase.from('tasks').delete().eq('id', taskId).select('id'));
    if (!rows || rows.length === 0) throw new Error('forbidden');
  });
