import { formatCents, progressPercent, ROLE_LABELS } from '@complice/shared';
import { router } from 'expo-router';
import { Bell, CalendarDays, Link2, Plus, UserRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from '@/components/icon-button';
import { Logo } from '@/components/mascot';
import { EmptyState, ErrorState, Loading } from '@/components/states';
import { Button, Card, Chip, ProgressBar, Row, T } from '@/components/ui';
import { formatEventDate } from '@/lib/format';
import { useMyEvents, useNotifications, useProfile, type MyEvent } from '@/lib/queries';
import { useNow } from '@/lib/use-now';
import { colors, gutter, space } from '@/theme/tokens';

export default function MyEvents() {
  const events = useMyEvents();
  const profile = useProfile();
  const notifications = useNotifications();
  const [tab, setTab] = useState<'current' | 'memories'>('current');
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;

  const now = useNow();
  const { current, memories } = useMemo(() => {
    const list = events.data ?? [];
    const isMemory = (e: MyEvent) => e.event.status !== 'active' || new Date(e.event.reveal_at).getTime() <= now;
    return { current: list.filter((e) => !isMemory(e)), memories: list.filter(isMemory).reverse() };
  }, [events.data, now]);
  const shown = tab === 'current' ? current : memories;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} tintColor={colors.coral} />}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Logo size="sm" />
          <Row gap={space.sm}>
            <IconButton label={unread ? `Notifications, ${unread} non lues` : 'Notifications'} onPress={() => router.push('/notifications')} dot={unread > 0}>
              <Bell size={22} color={colors.ink} strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Mon profil" onPress={() => router.push('/profile')}>
              <UserRound size={22} color={colors.ink} strokeWidth={1.75} />
            </IconButton>
          </Row>
        </Row>

        <View>
          <T v="h1">Salut {profile.data?.display_name ?? ''} !</T>
          <T color={colors.inkSoft}>Tes cadeaux en préparation et tes souvenirs.</T>
        </View>

        <Row style={{ backgroundColor: colors.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: colors.border }} gap={4}>
          {(['current', 'memories'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              onPress={() => setTab(k)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 999, backgroundColor: tab === k ? colors.violet : 'transparent', alignItems: 'center' }}
            >
              <T v="label" color={tab === k ? colors.white : colors.inkSoft}>
                {k === 'current' ? `En cours (${current.length})` : `Souvenirs (${memories.length})`}
              </T>
            </Pressable>
          ))}
        </Row>

        {events.isPending ? (
          <Loading />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : shown.length === 0 ? (
          tab === 'current' ? (
            <EmptyState title="Aucun cadeau en préparation" text="Crée une cagnotte pour un proche, ou rejoins un groupe avec le lien reçu." />
          ) : (
            <EmptyState title="Pas encore de souvenirs" text="Après l’ouverture de la capsule, l’événement apparaîtra ici avec ses messages." />
          )
        ) : (
          shown.map((e) => <EventCard key={e.event.id} item={e} />)
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: gutter, right: gutter, bottom: space.xxl, flexDirection: 'row', gap: space.md }}>
        <Button label="Créer une cagnotte" icon={<Plus size={20} color={colors.white} strokeWidth={2.25} />} onPress={() => router.push('/create')} style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rejoindre avec un lien"
          onPress={() => router.push('/join')}
          style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
        >
          <Link2 size={22} color={colors.ink} strokeWidth={1.75} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function EventCard({ item }: { item: MyEvent }) {
  const e = item.event;
  const pct = progressPercent(e.collected_cents, e.target_cents);
  return (
    <Card onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })} accessibilityLabel={`${e.title}, ${pct} % collectés`} style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <T v="h3" style={{ flex: 1 }}>
          {e.title}
        </T>
        <Chip label={ROLE_LABELS[item.role]} tone={item.role === 'organizer' ? 'coral' : 'lavender'} />
      </Row>
      <Row gap={6}>
        <CalendarDays size={16} color={colors.coral} strokeWidth={1.75} />
        <T v="small" color={colors.inkSoft}>
          {formatEventDate(e.gift_at, e.timezone)}
        </T>
        {e.is_demo ? <Chip label="Démo" tone="sun" /> : null}
      </Row>
      {item.role !== 'beneficiary' ? (
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="label">
              {formatCents(e.collected_cents)} <T v="small" color={colors.inkSoft}>/ {formatCents(e.target_cents)}</T>
            </T>
            <T v="label" color={colors.coralDark}>
              {pct} %
            </T>
          </Row>
          <ProgressBar value={pct} height={8} label={`Cagnotte ${pct} %`} />
        </View>
      ) : null}
    </Card>
  );
}
