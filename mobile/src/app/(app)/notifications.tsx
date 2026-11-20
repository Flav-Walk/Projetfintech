import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Card, Row, Screen, T } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries';
import type { NotificationRow } from '@/lib/types';
import { colors } from '@/theme/tokens';

function label(n: NotificationRow): string {
  switch (n.kind) {
    case 'invitation':
      return 'Tu as été invité·e dans un groupe';
    case 'vote_closing':
      return 'Le vote se termine bientôt';
    case 'task_assigned':
      return `Une mission t’a été confiée : « ${String(n.data.title ?? '')} »`;
    case 'capsule_open':
      return 'La capsule est ouverte !';
    case 'gift_selected':
      return 'Le cadeau a été choisi';
    case 'member_joined':
      return 'Quelqu’un a rejoint le groupe';
    default:
      return 'Nouveau message';
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
      <BackHeader title="Notifications" fallback="/events" />
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState title="Tout est calme" text="Les invitations, missions confiées, choix du cadeau et ouvertures de capsule s’afficheront ici." />
      ) : (
        list.data.map((n) => (
          <Card key={n.id} onPress={n.event_id ? () => router.push({ pathname: '/event/[id]', params: { id: n.event_id! } }) : undefined}>
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
