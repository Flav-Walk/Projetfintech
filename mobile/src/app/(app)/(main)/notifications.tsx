import { router } from 'expo-router';
import { Bell, CalendarClock, Gift, Heart, ListChecks, Mail, Mailbox, MessageCircle, Settings2, UserCheck, UserRoundPlus } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderAction, HeaderMeta, ScreenHeader } from '@/components/headers';
import { Divider, Group, SkeletonList } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { ErrorState } from '@/components/states';
import { T } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries';
import { useFriends } from '@/lib/social';
import type { NotificationRow } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { colors, fonts, gutter, space, tints, type Tint } from '@/theme/tokens';

/** Même familles que le journal d'une cagnotte (tokens.tints) : groupe, soleil, argent, fait, capsule. */
type Look = { Icon: typeof Bell; tint: Tint };
const LOOK: Record<string, Look> = {
  friend_request: { Icon: UserRoundPlus, tint: 'group' },
  friend_accepted: { Icon: UserCheck, tint: 'done' },
  event_invite: { Icon: Mail, tint: 'money' },
  invitation: { Icon: Mail, tint: 'money' },
  vote_closing: { Icon: CalendarClock, tint: 'sun' },
  gift_selected: { Icon: Gift, tint: 'sun' },
  task_assigned: { Icon: ListChecks, tint: 'group' },
  capsule_open: { Icon: Mailbox, tint: 'capsule' },
  thanks: { Icon: Heart, tint: 'money' },
  message: { Icon: MessageCircle, tint: 'group' },
  member_joined: { Icon: UserRoundPlus, tint: 'group' },
};

function label(n: NotificationRow, names: Map<string, string>): string {
  const title = n.data.title ? ` « ${String(n.data.title)} »` : '';
  const who = names.get(String(n.data.from ?? '')) ?? 'Quelqu’un';
  switch (n.kind) {
    case 'friend_request':
      return `${who} veut t’ajouter en ami`;
    case 'friend_accepted':
      return `${who} a accepté ta demande : vous êtes amis`;
    case 'event_invite':
      return n.data.role === 'beneficiary' ? `${who} te prépare une surprise` : `${who} t’invite à préparer${title || ' un cadeau commun'}`;
    case 'invitation':
      return 'Tu as été invité·e dans un groupe';
    case 'vote_closing':
      return `Le vote se termine bientôt${title} : moins de 24 h pour donner ta voix`;
    case 'task_assigned':
      return `Une mission t’a été confiée : « ${String(n.data.title ?? '')} »`;
    case 'capsule_open':
      return `La capsule${title} est ouverte !`;
    case 'gift_selected':
      return 'Le cadeau a été choisi';
    case 'member_joined':
      return 'Quelqu’un a rejoint le groupe';
    case 'message':
      return 'Nouveaux messages dans la discussion';
    case 'thanks':
      return `La personne fêtée a laissé un mot pour le groupe${title}`;
    default:
      return 'Du nouveau dans ton groupe';
  }
}

/** Écran à ouvrir : un toucher mène directement à ce qui est concerné. */
function open(n: NotificationRow) {
  if (n.kind === 'friend_request' || n.kind === 'friend_accepted') return router.push('/friends');
  if (n.kind === 'event_invite') return router.push('/events');
  if (!n.event_id) return;
  const tab = { vote_closing: 'ideas', gift_selected: 'ideas', task_assigned: 'missions', capsule_open: 'capsule', thanks: 'capsule', message: 'chat' }[n.kind] ?? '';
  router.push(`/event/${n.event_id}/${tab}` as never);
}

export default function Notifications() {
  const list = useNotifications();
  const friends = useFriends();
  const markRead = useMarkNotificationsRead();
  const unreadCount = list.data?.filter((n) => !n.read_at).length ?? 0;
  const unread = unreadCount > 0;
  const names = useMemo(() => new Map((friends.data ?? []).map((f) => [f.user_id, f.display_name])), [friends.data]);
  const now = useNow();

  useEffect(() => {
    // Ouvrir la liste vaut lecture ; une seule fois par affichage.
    if (unread) {
      const t = setTimeout(() => markRead.mutate(null), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const groups = useMemo(() => {
    const today: NotificationRow[] = [];
    const week: NotificationRow[] = [];
    const older: NotificationRow[] = [];
    for (const n of list.data ?? []) {
      const age = now - new Date(n.created_at).getTime();
      (age < 86400000 ? today : age < 7 * 86400000 ? week : older).push(n);
    }
    return [
      { title: 'Aujourd’hui', items: today },
      { title: 'Cette semaine', items: week },
      { title: 'Plus tôt', items: older },
    ].filter((g) => g.items.length);
  }, [list.data, now]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.coral} />}>
        <ScreenHeader
          title="Activité"
          meta={list.data ? <HeaderMeta dot={unreadCount ? colors.coral : colors.success} text={unreadCount ? `${unreadCount} nouveauté${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'} /> : undefined}
          actions={
            <HeaderAction label="Préférences de notification" onPress={() => router.push('/profile')}>
              <Settings2 size={20} color={colors.ink} strokeWidth={2} />
            </HeaderAction>
          }
        />
        {list.isPending ? (
          <SkeletonList rows={5} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : groups.length === 0 ? (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
            <Mascot size={96} mood="calm" />
            <T v="h3">Tout est calme</T>
            <T color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 320 }}>
              Demandes d’ami, invitations, votes qui se terminent, missions confiées et ouvertures de capsule s’afficheront ici. Pas de rappel inutile.
            </T>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.title} style={{ gap: space.sm }}>
              <T v="overline" color={colors.inkSoft}>
                {g.title}
              </T>
              <Group style={{ paddingHorizontal: 0 }}>
                {g.items.map((n, i) => {
                  const look = LOOK[n.kind] ?? { Icon: Gift, tint: 'group' };
                  const tint = tints[look.tint];
                  const text = label(n, names);
                  return (
                    <Animated.View key={n.id} entering={FadeIn.duration(160)}>
                      {i > 0 ? <View style={{ marginLeft: 72 }}><Divider /></View> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${n.read_at ? '' : 'Nouveau. '}${text}, ${timeAgo(n.created_at)}`}
                        onPress={() => open(n)}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, backgroundColor: pressed ? colors.surfaceSoft : n.read_at ? colors.surface : '#FFFBF8' })}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <look.Icon size={19} color={tint.fg} strokeWidth={2.1} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <T v="body" style={{ fontFamily: n.read_at ? fonts.semiBold : fonts.bold }}>
                            {text}
                          </T>
                          <T v="small" color={colors.inkSoft}>
                            {timeAgo(n.created_at)}
                          </T>
                        </View>
                        {!n.read_at ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }} accessibilityElementsHidden /> : null}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </Group>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
