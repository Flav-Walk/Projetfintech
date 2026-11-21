import type { BadgeKind, EventProgress, NextAction } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ClipboardCheck,
  Coins,
  Gift,
  Hourglass,
  Lightbulb,
  MessageCircleHeart,
  PenLine,
  PartyPopper,
  Settings2,
  UserPlus,
  Vote,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarPile } from '@/components/avatar';
import { FundingCard, StepTracker } from '@/components/event-parts';
import { IconButton } from '@/components/icon-button';
import { Skeleton } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { StampShelf, STAMP_ORDER } from '@/components/stamps';
import { ErrorState } from '@/components/states';
import { Banner, Button, Chip, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/capsule';
import { activityLabel, formatEventDate, timeAgo, timeUntil } from '@/lib/format';
import { useActivity, useEvent, useEventRealtime, useFunding, useMembers, useProgress, useRevealedGift } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, fonts, gutter, radius, shadow, space } from '@/theme/tokens';

type Next = { title: string; text: string; label: string; route: string; Icon: LucideIcon; tone: 'violet' | 'coral' | 'sun' | 'night' };
const NEXT: Record<NextAction, Next> = {
  invite: { title: 'Invite le groupe', text: 'Une cagnotte se prépare à plusieurs : ajoute tes amis ou partage un lien.', label: 'Inviter', route: 'members', Icon: UserPlus, tone: 'violet' },
  propose: { title: 'Propose la première idée', text: 'Une photo, un prix, un lien : le groupe pourra voter.', label: 'Proposer une idée', route: 'idea/edit', Icon: Lightbulb, tone: 'sun' },
  vote: { title: 'Donne ta voix', text: 'Choisis l’idée que tu préfères. Tu pourras changer d’avis jusqu’à la clôture.', label: 'Voir les idées', route: 'ideas', Icon: Vote, tone: 'violet' },
  select_gift: { title: 'Choisis le cadeau retenu', text: 'Le vote est clos : confirme le choix du groupe.', label: 'Voir le classement', route: 'ideas', Icon: Gift, tone: 'violet' },
  finish_task: { title: 'Termine ta mission', text: 'Coche-la quand c’est fait : tout le groupe le verra.', label: 'Mes missions', route: 'missions', Icon: ClipboardCheck, tone: 'violet' },
  write_capsule: { title: 'Écris ton mot pour la capsule', text: 'Un message, une photo : scellés jusqu’au jour J.', label: 'Écrire mon mot', route: 'capsule', Icon: PenLine, tone: 'night' },
  claim_task: { title: 'Donne un coup de main', text: 'Des missions attendent quelqu’un : commander, emballer, la carte…', label: 'Voir les missions', route: 'missions', Icon: ClipboardCheck, tone: 'violet' },
  // Formulation neutre : participer reste libre, sans montant suggéré ni rappel insistant.
  contribute: { title: 'La cagnotte est ouverte', text: 'Participe si tu le souhaites, du montant de ton choix.', label: 'Voir la cagnotte', route: 'contribute', Icon: Coins, tone: 'coral' },
  wait_reveal: { title: 'Tout est prêt de ton côté', text: 'Merci ! Rendez-vous le jour J pour l’ouverture.', label: 'Voir la capsule', route: 'capsule', Icon: Hourglass, tone: 'sun' },
  open_capsule: { title: 'Ta capsule est ouverte', text: 'Tes proches t’ont préparé des mots, des photos et un cadeau.', label: 'Découvrir', route: 'capsule', Icon: PartyPopper, tone: 'night' },
  view_memories: { title: 'Revivre les souvenirs', text: 'Les mots, les photos et le cadeau, pour toujours.', label: 'Ouvrir la capsule', route: 'capsule', Icon: PartyPopper, tone: 'night' },
};
const TONE = {
  violet: { bg: colors.violet, fg: colors.white, sub: colors.lavenderStrong, btn: 'white' as const },
  coral: { bg: colors.coralSoft, fg: colors.ink, sub: colors.inkSoft, btn: 'primary' as const },
  sun: { bg: colors.sunSoft, fg: colors.ink, sub: colors.inkSoft, btn: 'secondary' as const },
  night: { bg: colors.night, fg: colors.white, sub: colors.lavenderStrong, btn: 'white' as const },
};

export default function EventHome() {
  const id = useEventId();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ created?: string; welcome?: string }>();
  useEventRealtime(id);
  const event = useEvent(id);
  const progress = useProgress(id);
  const members = useMembers(id);
  const isBeneficiary = progress.data?.my_role === 'beneficiary';
  const ready = !!progress.data && !isBeneficiary;
  const funding = useFunding(id, ready);
  const activity = useActivity(id, ready);
  const gift = useRevealedGift(id, ready);

  if (event.isPending || progress.isPending) return <HomeSkeleton />;
  if (event.isError) return <SafeAreaView style={{ flex: 1 }}><ErrorState error={event.error} onRetry={() => event.refetch()} /></SafeAreaView>;
  if (!event.data || !progress.data) {
    return (
      <SafeAreaView style={{ flex: 1, padding: gutter, gap: space.lg, backgroundColor: colors.bg }}>
        <Banner tone="error" title="Cagnotte introuvable">Elle n’existe plus ou tu n’en fais plus partie.</Banner>
        <Button label="Retour à l’accueil" onPress={() => router.replace('/events')} />
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
        contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.huge }}
        refreshControl={
          <RefreshControl
            refreshing={event.isRefetching}
            tintColor={colors.coral}
            onRefresh={() => {
              void event.refetch();
              void progress.refetch();
              void members.refetch();
              void funding.refetch();
              void activity.refetch();
            }}
          />
        }
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <IconButton label="Retour à l’accueil" onPress={() => (router.canGoBack() ? router.back() : router.replace('/events'))}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2} />
          </IconButton>
          <Row gap={space.sm}>
            {e.is_demo ? <Chip label="Démo" tone="sun" /> : null}
            {isManager ? (
              <IconButton label="Réglages de la cagnotte" onPress={() => go('settings')}>
                <Settings2 size={22} color={colors.ink} strokeWidth={1.75} />
              </IconButton>
            ) : null}
          </Row>
        </Row>

        <View style={{ gap: space.sm }}>
          <T v="overline" color={colors.coralInk}>
            {e.occasion} · {formatEventDate(e.gift_at, e.timezone, false)}
          </T>
          <T v="h1" accessibilityRole="header">
            {e.title}
          </T>
          {!isBeneficiary ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Le groupe : ${preparers.length} membre${preparers.length > 1 ? 's' : ''}`} onPress={() => go('members')}>
              <Row gap={space.sm}>
                <AvatarPile people={preparers.map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? '?', path: m.profiles?.avatar_path }))} />
                <T v="label" color={colors.inkSoft}>
                  {preparers.length} préparent pour {e.beneficiary_name}
                </T>
              </Row>
            </Pressable>
          ) : null}
        </View>

        {params.created === '1' ? (
          <Banner tone="info" title="Ta cagnotte est prête !" icon={<Mascot size={40} mood="wink" />}>
            Invite maintenant le groupe : tes amis en deux touches, ou un lien à partager.
          </Banner>
        ) : params.welcome === '1' ? (
          <Banner tone="info" title="Bienvenue dans le groupe !" icon={<Mascot size={40} />}>
            Rien n’est visible par {e.beneficiary_name} avant l’ouverture de la capsule.
          </Banner>
        ) : null}

        <Animated.View entering={FadeInDown.duration(240)}>
          <NextCard next={next} onPress={() => go(next.route)} />
        </Animated.View>

        {isBeneficiary ? null : (
          <>
            {funding.data ? (
              <FundingCard funding={funding.data}>
                {p.contributions_open ? (
                  <Button variant="white" label="Participer" iconRight={<ArrowRight size={20} color={colors.coral} />} onPress={() => go('contribute')} accessibilityHint="Paiement simulé : aucun argent réel n’est débité." />
                ) : null}
              </FundingCard>
            ) : funding.isError ? (
              <ErrorState error={funding.error} onRetry={() => funding.refetch()} />
            ) : (
              <Skeleton height={260} radius={radius.card} />
            )}

            <Preparations progress={p} onOpen={go} />

            <MyStamps eventId={id} me={session?.user.id} />

            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }, shadow.card]}>
              <T v="h3">Les décisions</T>
              <Line label="Cadeau retenu" value={gift.data ? gift.data.title : p.votes_open ? 'vote en cours' : 'à choisir'} strong={!!gift.data} onPress={() => go('ideas')} />
              <DateLine label="Fin du vote" iso={e.votes_close_at} tz={e.timezone} />
              <DateLine label="Fin des participations" iso={e.contributions_close_at} tz={e.timezone} />
              <DateLine label="Remise du cadeau" iso={e.gift_at} tz={e.timezone} />
              <DateLine label="Ouverture de la capsule" iso={e.reveal_at} tz={e.timezone} />
            </View>

            <View style={{ gap: space.md }}>
              <T v="h3">Dernière activité</T>
              {activity.isPending ? (
                <Skeleton height={60} />
              ) : (activity.data ?? []).length === 0 ? (
                <T color={colors.inkSoft}>Rien pour l’instant.</T>
              ) : (
                (activity.data ?? []).slice(0, 6).map((a) => (
                  <Row key={a.id} style={{ alignItems: 'flex-start' }}>
                    <MessageCircleHeart size={18} color={colors.violet} strokeWidth={2} style={{ marginTop: 2 }} />
                    <T v="small" style={{ flex: 1 }}>
                      {activityLabel(a)}
                    </T>
                    <T v="small" color={colors.inkFaint}>
                      {timeAgo(a.created_at)}
                    </T>
                  </Row>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NextCard({ next, onPress }: { next: Next; onPress: () => void }) {
  const t = TONE[next.tone];
  return (
    <View style={[{ backgroundColor: t.bg, borderRadius: radius.card, padding: space.xl, gap: space.md, overflow: 'hidden' }, shadow.card]} accessible={false}>
      <View style={{ position: 'absolute', right: -24, bottom: -24, opacity: 0.14 }} importantForAccessibility="no-hide-descendants">
        <next.Icon size={140} color={t.fg} strokeWidth={1.5} />
      </View>
      <T v="overline" color={t.sub}>
        Prochaine étape pour toi
      </T>
      <T v="h2" color={t.fg}>
        {next.title}
      </T>
      <T color={t.sub} style={{ maxWidth: 300 }}>
        {next.text}
      </T>
      <Button label={next.label} variant={t.btn} iconRight={<ArrowRight size={20} color={t.btn === 'white' ? colors.coral : colors.white} />} onPress={onPress} style={{ alignSelf: 'flex-start' }} compact />
    </View>
  );
}

/** Progression collective (violet) : étapes et compteurs, sans aucun montant. */
function Preparations({ progress: p, onOpen }: { progress: EventProgress; onOpen: (r: string) => void }) {
  const stats: { label: string; value: string; route: string; Icon: LucideIcon }[] = [
    { label: 'Idées', value: String(p.proposals), route: 'ideas', Icon: Lightbulb },
    { label: 'Missions', value: `${p.tasks_done}/${p.tasks_total}`, route: 'missions', Icon: ClipboardCheck },
    { label: 'Mots scellés', value: `${p.capsule_published}/${p.preparers}`, route: 'capsule', Icon: PenLine },
  ];
  return (
    <View style={[{ backgroundColor: colors.violet, borderRadius: radius.card, padding: space.xl, gap: space.lg }, shadow.card]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3" color={colors.white}>
          Les préparatifs
        </T>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
          <T v="label" color={colors.white}>
            {p.steps_done}/5 étapes
          </T>
        </View>
      </Row>
      <StepTracker progress={p} />
      <Row gap={space.sm}>
        {stats.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={`${s.label} : ${s.value}`}
            onPress={() => onOpen(s.route)}
            style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)', borderRadius: 16, padding: space.md, gap: 2 })}
          >
            <s.Icon size={18} color={colors.white} strokeWidth={2} />
            <T v="moneySmall" color={colors.white}>
              {s.value}
            </T>
            <T v="small" color={colors.lavenderStrong} numberOfLines={1}>
              {s.label}
            </T>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

/** Mes timbres : un par geste réel (idée, voix, mission, mot), attribué une seule fois par la base. */
function MyStamps({ eventId, me }: { eventId: string; me?: string }) {
  const badges = useBadges(eventId);
  const mine = new Set<BadgeKind>((badges.data ?? []).filter((b) => b.user_id === me && STAMP_ORDER.includes(b.badge)).map((b) => b.badge));
  const helpers = new Set((badges.data ?? []).filter((b) => b.user_id !== me && STAMP_ORDER.includes(b.badge)).map((b) => b.user_id)).size;
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md }, shadow.card]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3">Mes timbres</T>
        <T v="label" color={colors.inkSoft}>
          {mine.size}/{STAMP_ORDER.length}
        </T>
      </Row>
      <StampShelf earned={mine} />
      <T v="small" color={colors.inkSoft}>
        {mine.size === STAMP_ORDER.length
          ? 'Collection complète : merci pour ton aide à chaque étape !'
          : helpers > 0
            ? `${helpers} autre${helpers > 1 ? 's' : ''} membre${helpers > 1 ? 's ont' : ' a'} déjà aidé. Chaque geste compte, quel que soit le montant donné.`
            : 'Chaque geste compte, quel que soit le montant donné.'}
      </T>
    </View>
  );
}

function Line({ label, value, strong, onPress }: { label: string; value: string; strong?: boolean; onPress?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T v="small" color={colors.inkSoft}>
        {label}
      </T>
      <Pressable accessibilityRole="link" onPress={onPress} style={{ flexShrink: 1 }}>
        <T v="label" color={strong ? colors.ink : colors.inkSoft} numberOfLines={1}>
          {value}
        </T>
      </Pressable>
    </Row>
  );
}

function DateLine({ label, iso, tz }: { label: string; iso: string; tz: string }) {
  const now = useNow();
  const past = new Date(iso).getTime() <= now;
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Row gap={6} style={{ flexShrink: 1 }}>
        <CalendarClock size={15} color={past ? colors.inkFaint : colors.violet} strokeWidth={2} />
        <T v="small" color={colors.inkSoft}>
          {label}
        </T>
      </Row>
      <T v="label" color={past ? colors.inkFaint : colors.ink} style={{ textAlign: 'right', flexShrink: 1, fontFamily: fonts.bold }}>
        {formatEventDate(iso, tz)}
        {past ? ' · passé' : ` · ${timeUntil(iso, now)}`}
      </T>
    </Row>
  );
}

function HomeSkeleton() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: gutter, gap: space.lg }}>
      <Skeleton height={44} width={44} radius={22} />
      <Skeleton height={14} width="40%" />
      <Skeleton height={32} width="80%" />
      <Skeleton height={170} radius={radius.card} />
      <Skeleton height={260} radius={radius.card} />
    </SafeAreaView>
  );
}
