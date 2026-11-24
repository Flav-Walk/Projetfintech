import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type { MessageRow } from './types';

const PAGE = 30;
export const chatKeys = { messages: (id: string) => ['event', id, 'messages'] as const };

/** Historique paginé (du plus récent au plus ancien) + nouveaux messages en direct. */
export function useMessages(eventId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${eventId}` }, () =>
        qc.invalidateQueries({ queryKey: chatKeys.messages(eventId) }),
      )
      .subscribe();
    // Retour au premier plan : on recharge (messages reçus pendant une coupure).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') qc.invalidateQueries({ queryKey: chatKeys.messages(eventId) });
    });
    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [eventId, qc]);

  return useInfiniteQuery({
    queryKey: chatKeys.messages(eventId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from('messages')
        .select('id, event_id, author_id, body, client_id, created_at, profiles(display_name, avatar_path)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (pageParam) q = q.lt('created_at', pageParam);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as MessageRow[];
    },
    getNextPageParam: (last) => (last.length < PAGE ? undefined : last[last.length - 1]!.created_at),
  });
}

export type Outgoing = { client_id: string; body: string; created_at: string; status: 'sending' | 'failed' };

const outboxKey = (eventId: string) => `complice.outbox.${eventId}`;

/**
 * File d'envoi locale : chaque message a un client_id stable. Un renvoi après coupure
 * ne crée pas de doublon (contrainte unique author_id + client_id côté base).
 * La file survit à la fermeture de l'app.
 */
export function useOutbox(eventId: string) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<Outgoing[]>([]);
  const itemsRef = useRef<Outgoing[]>([]);

  const persist = useCallback(
    (next: Outgoing[]) => {
      itemsRef.current = next;
      setItems(next);
      AsyncStorage.setItem(outboxKey(eventId), JSON.stringify(next)).catch(() => undefined);
    },
    [eventId],
  );

  const deliver = useCallback(
    async (item: Outgoing) => {
      persist(itemsRef.current.map((i) => (i.client_id === item.client_id ? { ...i, status: 'sending' } : i)));
      const { error } = await supabase
        .from('messages')
        .insert({ event_id: eventId, body: item.body, client_id: item.client_id, author_id: session?.user.id });
      // 23505 : déjà reçu par la base lors d'un essai précédent -> considéré comme envoyé.
      if (!error || error.code === '23505') {
        await qc.invalidateQueries({ queryKey: chatKeys.messages(eventId) });
        persist(itemsRef.current.filter((i) => i.client_id !== item.client_id));
      } else {
        persist(itemsRef.current.map((i) => (i.client_id === item.client_id ? { ...i, status: 'failed' } : i)));
      }
    },
    [eventId, persist, qc, session?.user.id],
  );

  // Reprise : file restaurée au montage, renvoyée au retour au premier plan.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(outboxKey(eventId))
      .then((raw) => {
        if (!alive || !raw) return;
        const restored = (JSON.parse(raw) as Outgoing[]).map((i) => ({ ...i, status: 'failed' as const }));
        persist(restored);
        restored.forEach((i) => void deliver(i));
      })
      .catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') itemsRef.current.filter((i) => i.status === 'failed').forEach((i) => void deliver(i));
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [eventId, deliver, persist]);

  const send = useCallback(
    (body: string) => {
      const item: Outgoing = { client_id: Crypto.randomUUID(), body, created_at: new Date().toISOString(), status: 'sending' };
      persist([...itemsRef.current, item]);
      void deliver(item);
    },
    [deliver, persist],
  );

  return { items, send, retry: deliver };
}

export function flattenMessages(data: InfiniteData<MessageRow[]> | undefined): MessageRow[] {
  return data?.pages.flat() ?? [];
}
