import { BADGE_LABELS, type BadgeKind } from '@complice/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, gutter, radius, shadow, space } from '@/theme/tokens';
import { Stamp } from './stamps';
import { T } from './ui';

type Toast = { id: number; kind: 'badge'; badge: BadgeKind } | { id: number; kind: 'text'; title: string; text?: string };
type NewToast = { kind: 'badge'; badge: BadgeKind } | { kind: 'text'; title: string; text?: string };

/**
 * Retour visuel d'accomplissement. Les timbres gagnés arrivent par Realtime (activité « badge_awarded »
 * dont je suis l'auteur) : une attribution n'a lieu qu'une fois côté base, le toast aussi.
 * Animations courtes (≤ 250 ms) et remplacées par un simple fondu si « Réduire les animations ».
 */
export function CelebrationHost({ eventId, children }: { eventId: string; children: ReactNode }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const seq = useRef(0);

  const celebrate = useCallback((t: NewToast) => {
    seq.current += 1;
    const next = { ...t, id: seq.current } as Toast;
    setToast(next);
    const msg = next.kind === 'badge' ? `Nouveau timbre : ${BADGE_LABELS[next.badge].title}` : next.title;
    AccessibilityInfo.announceForAccessibility(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const me = session?.user.id;
    if (!me || !eventId) return;
    const channel = supabase
      .channel(`celebrate:${eventId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter: `event_id=eq.${eventId}` }, (payload) => {
        const row = payload.new as { actor_id?: string; kind?: string; data?: { badge?: BadgeKind } };
        if (row.kind === 'badge_awarded' && row.actor_id === me && row.data?.badge) {
          celebrate({ kind: 'badge', badge: row.data.badge });
          qc.invalidateQueries({ queryKey: ['event', eventId, 'badges'] });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, session?.user.id, celebrate, qc]);

  return (
    <View style={{ flex: 1 }}>
        {children}
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={reduce ? FadeIn.duration(150) : ZoomIn.duration(250)}
            exiting={FadeOut.duration(150)}
            style={{ position: 'absolute', top: insets.top + space.sm, left: gutter, right: gutter }}
            accessibilityLiveRegion="polite"
          >
            <Pressable
              onPress={() => setToast(null)}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={{ backgroundColor: colors.night, borderRadius: radius.card, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, ...shadow.card }}
            >
              {toast.kind === 'badge' ? <Stamp kind={toast.badge} earned size={52} /> : null}
              <View style={{ flex: 1 }}>
                <T v="label" color={colors.sun}>
                  {toast.kind === 'badge' ? 'Nouveau timbre !' : toast.title}
                </T>
                <T v="small" color={colors.white}>
                  {toast.kind === 'badge' ? `${BADGE_LABELS[toast.badge].title} · ${BADGE_LABELS[toast.badge].hint}` : (toast.text ?? '')}
                </T>
              </View>
            </Pressable>
          </Animated.View>
        ) : null}
    </View>
  );
}
