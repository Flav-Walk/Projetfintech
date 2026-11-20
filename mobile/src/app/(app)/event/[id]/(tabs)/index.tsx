import type { NextAction } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, MessageCircleHeart, Settings2, UserPlus, Users } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarStack, FundingCard, StepTracker } from '@/components/event-parts';
import { IconButton } from '@/components/icon-button';
import { Mascot } from '@/components/mascot';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Row, T } from '@/components/ui';
import { activityLabel, formatEventDate, timeAgo, timeUntil } from '@/lib/format';
import { useActivity, useEvent, useEventRealtime, useFunding, useMembers, useProgress } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, gutter, space } from '@/theme/tokens';

const NEXT: Record<NextAction, { title: string; label: string; route: string }> = {
  invite: { title: 'Invite le groupe', label: 'Partager le lien', route: 'members' },
  vote: { title: 'Voter pour le cadeau', label: 'Voir les idées', route: 'ideas' },
  select_gift: { title: 'Choisir le cadeau retenu', label: 'Voir le classement', route: 'ideas' },
  contribute: { title: 'Participer à la cagnotte', label: 'Participer', route: 'contribute' },
  finish_task: { title: 'Terminer ta mission', label: 'Mes missions', route: 'missions' },
  write_capsule: { title: 'Écrire ton mot pour la capsule', label: 'Écrire', route: 'capsule' },
  wait_reveal: { title: 'Tout est prêt, rendez-vous le jour J', label: 'Voir la capsule', route: 'capsule' },
  open_capsule: { title: 'Ta capsule est ouverte', label: 'Découvrir', route: 'capsule' },
  view_memories: { title: 'Revivre les souvenirs', label: 'Voir la capsule', route: 'capsule' },
};

export default function EventHome() {
  const id = useEventId();
  const params = useLocalSearchParams<{ created?: string; welcome?: string }>();
  useEventRealtime(id);
  const event = useEvent(id);
  const progress = useProgress(id);
  const members = useMembers(id);
  const isBeneficiary = progress.data?.my_role === 'beneficiary';
  const funding = useFunding(id, !!progress.data && !isBeneficiary);
  const activity = useActivity(id, !!progress.data && !isBeneficiary);

  if (event.isPending || progress.isPending) return <Loading />;
  if (event.isError) return <SafeAreaView style={{ flex: 1 }}><ErrorState error={event.error} onRetry={() => event.refetch()} /></SafeAreaView>;
  if (!event.data || !progress.data) {
    return (
      <SafeAreaView style={{ flex: 1, padding: gutter, gap: space.lg }}>
        <Banner tone="error" title="Événement introuvable">Il n’existe pas ou tu n’en fais plus partie.</Banner>
        <Button label="Mes événements" onPress={() => router.replace('/events')} />
      </SafeAreaView>
    );
  }

  const e = event.data;
  const p = progress.data;
  const isManager = p.my_role === 'organizer' || p.my_role === 'co_organizer';
  const preparers = (members.data ?? []).filter((m) => m.role !== 'beneficiary');
  const next = NEXT[p.next_action];
  const go = (route: string) => router.push(`/event/${id}/${route === 'index' ? '' : route}` as never);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={event.isRefetching}
            tintColor={colors.coral}
            onRefresh={() => {
              event.refetch();
              progress.refetch();
              members.refetch();
              funding.refetch();
              activity.refetch();
            }}
          />
        }
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton label="Mes événements" onPress={() => router.replace('/events')}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2} />
          </IconButton>
          <Row gap={space.sm}>
            {e.is_demo ? <Chip label="Données de démo" tone="sun" /> : null}
            {isManager ? (
              <IconButton label="Réglages de l’événement" onPress={() => go('settings')}>
                <Settings2 size={22} color={colors.ink} strokeWidth={1.75} />
              </IconButton>
            ) : null}
          </Row>
        </Row>

        <View style={{ gap: space.sm }}>
          <T v="h1" accessibilityRole="header">
            {e.title}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={`Voir les ${preparers.length} membres`} onPress={() => go('members')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AvatarStack names={preparers.map((m) => m.profiles?.display_name ?? '?')} />
              <ChevronRight size={20} color={colors.inkSoft} />
            </Row>
          </Pressable>
        </View>

        {params.created === '1' ? (
          <Banner tone="info" title="Ta cagnotte est prête !" icon={<Mascot size={40} mood="wink" />}>
            Invite maintenant le groupe : partage le lien depuis « Membres et invitations ».
          </Banner>
        ) : params.welcome === '1' ? (
          <Banner tone="info" title="Bienvenue dans le groupe !" icon={<Mascot size={40} />}>
            Rien n’est visible par {e.beneficiary_name} avant l’ouverture de la capsule.
          </Banner>
        ) : null}

        {isBeneficiary ? (
          <Card tone="lavender" style={{ alignItems: 'center', gap: space.md }}>
            <Mascot size={96} />
            <T v="h2" style={{ textAlign: 'center' }}>
              Ta capsule t’attend
            </T>
            <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
              Tes proches t’ont préparé des mots, des photos et un cadeau.
            </T>
            <Button label="Découvrir vos messages" iconRight={<ArrowRight size={20} color={colors.white} />} onPress={() => go('capsule')} />
          </Card>
        ) : (
          <>
            {/* Argent (corail) */}
            {funding.data ? (
              <FundingCard collected={funding.data.collected_cents} target={funding.data.target_cents} contributors={funding.data.contributor_count}>
                {p.contributions_open ? (
                  <Button variant="white" label="Participer" iconRight={<ArrowRight size={20} color={colors.coral} />} onPress={() => go('contribute')} />
                ) : (
                  <T v="small" color={colors.white}>Les participations sont closes.</T>
                )}
              </FundingCard>
            ) : funding.isError ? (
              <ErrorState error={funding.error} onRetry={() => funding.refetch()} />
            ) : null}

            {/* Organisation (violet) */}
            <Card tone="violet" style={{ gap: space.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={space.sm}>
                  <ClipboardList size={22} color={colors.white} strokeWidth={1.75} />
                  <T v="h3" color={colors.white}>
                    Préparation collective
                  </T>
                </Row>
                <T v="label" color={colors.white}>
                  {p.steps_done}/5
                </T>
              </Row>
              <StepTracker progress={p} />
            </Card>

            <Card tone="lavender" onPress={() => go(next.route)} accessibilityLabel={`Prochaine action : ${next.title}`}>
              <Row>
                <CalendarCheck size={26} color={colors.violet} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <T v="small" color={colors.inkSoft}>
                    Prochaine action
                  </T>
                  <T v="h3">{next.title}</T>
                </View>
                <ChevronRight size={22} color={colors.ink} />
              </Row>
            </Card>

            <Card style={{ gap: space.md }}>
              <T v="h3">Dates importantes</T>
              <DateLine label="Fin du vote" iso={e.votes_close_at} tz={e.timezone} />
              <DateLine label="Fin des participations" iso={e.contributions_close_at} tz={e.timezone} />
              <DateLine label="Remise du cadeau" iso={e.gift_at} tz={e.timezone} />
              <DateLine label="Ouverture de la capsule" iso={e.reveal_at} tz={e.timezone} />
            </Card>

            <Row>
              <Button label="Missions" variant="outline" compact style={{ flex: 1 }} onPress={() => go('missions')} />
              {isManager ? (
                <Button label="Inviter" variant="secondary" compact style={{ flex: 1 }} icon={<UserPlus size={18} color={colors.white} strokeWidth={2} />} onPress={() => go('members')} />
              ) : (
                <Button label="Membres" variant="outline" compact style={{ flex: 1 }} icon={<Users size={18} color={colors.ink} strokeWidth={1.75} />} onPress={() => go('members')} />
              )}
            </Row>

            <Card style={{ gap: space.md }}>
              <T v="h3">Dernière activité</T>
              {activity.isPending ? (
                <T color={colors.inkSoft}>Chargement…</T>
              ) : activity.isError ? (
                <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
              ) : (activity.data ?? []).length === 0 ? (
                <T color={colors.inkSoft}>Rien pour l’instant.</T>
              ) : (
                (activity.data ?? []).slice(0, 5).map((a) => (
                  <Row key={a.id} style={{ alignItems: 'flex-start' }}>
                    <MessageCircleHeart size={20} color={colors.violet} strokeWidth={1.75} />
                    <T v="small" style={{ flex: 1 }}>
                      {activityLabel(a)}
                    </T>
                    <T v="small" color={colors.inkSoft}>
                      {timeAgo(a.created_at)}
                    </T>
                  </Row>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DateLine({ label, iso, tz }: { label: string; iso: string; tz: string }) {
  const now = useNow();
  const past = new Date(iso).getTime() <= now;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T v="small" color={colors.inkSoft}>
        {label}
      </T>
      <T v="label" color={past ? colors.inkSoft : colors.ink}>
        {formatEventDate(iso, tz)} · {past ? 'passé' : timeUntil(iso, now)}
      </T>
    </Row>
  );
}
