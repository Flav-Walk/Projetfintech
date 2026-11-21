import { router } from 'expo-router';
import { Bell, Settings2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { IconButton } from '@/components/icon-button';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Card, Row, Screen, T } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries';
import type { NotificationRow } from '@/lib/types';
import { colors } from '@/theme/tokens';

function label(n: NotificationRow): string {
  const title = n.data.title ? ` « ${String(n.data.title)} »` : '';
  switch (n.kind) {
    case 'invitation':
      return 'Tu as été invité·e dans un groupe';
    case 'vote_closing':
      return `Le vote se termine bientôt${title} : il te reste moins de 24 h pour donner ta voix`;
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

/** Onglet à ouvrir pour chaque type de notification. */
function target(n: NotificationRow): string {
  switch (n.kind) {
    case 'vote_closing':
    case 'gift_selected':
      return 'ideas';
    case 'task_assigned':
      return 'missions';
    case 'capsule_open':
    case 'thanks':
      return 'capsule';
    case 'message':
      return 'chat';
    default:
      return '';
  }
}

export default function Notifications() {
  const list = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = list.data?.some((n) => !n.read_at);

  useEffect(() => {
    // Ouvrir la liste vaut lecture ; une seule fois par affichage.
    if (unread) markRead.mutate(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  return (
    <Screen>
      <BackHeader
        title="Notifications"
        fallback="/events"
        right={
          <IconButton label="Préférences de notification" onPress={() => router.push('/profile')}>
            <Settings2 size={22} color={colors.ink} strokeWidth={1.75} />
          </IconButton>
        }
      />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Tout est calme" text="Les rappels de vote, missions confiées, choix du cadeau, messages et ouvertures de capsule s’afficheront ici." />
      ) : (
        list.data.map((n) => (
          <Card key={n.id} onPress={n.event_id ? () => router.push(`/event/${n.event_id}/${target(n)}` as never) : undefined} accessibilityLabel={label(n)}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Bell size={20} color={n.read_at ? colors.inkSoft : colors.coral} strokeWidth={1.75} />
              <View style={{ flex: 1 }}>
                <T v={n.read_at ? 'body' : 'bodyBold'}>{label(n)}</T>
                <T v="small" color={colors.inkSoft}>
                  {timeAgo(n.created_at)}
                </T>
              </View>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
