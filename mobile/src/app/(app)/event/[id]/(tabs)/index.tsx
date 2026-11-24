import type { BadgeKind, EventProgress, NextAction } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronLeft, ClipboardCheck, Coins, Gift, Hourglass, Lightbulb, PenLine, PartyPopper, Settings2, UserPlus, Vote, type LucideIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarPile } from '@/components/avatar';
import { Deadlines } from '@/components/deadlines';
import { EventCover } from '@/components/event-cover';
import { FundingCard } from '@/components/event-parts';
import { HeaderAction } from '@/components/headers';
import { Journal } from '@/components/journal';
import { Skeleton } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { Preparations } from '@/components/preparations';
import { PrivateImage } from '@/components/private-image';
import { StampShelf, STAMP_ORDER } from '@/components/stamps';
import { ErrorState } from '@/components/states';
import { Banner, Button, Row, T, TextLink } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useBadges } from '@/lib/capsule';
import { formatEventDate } from '@/lib/format';
import { useActivity, useEvent, useEventRealtime, useFunding, useMembers, useProgress, useRevealedGift } from '@/lib/queries';
import type { EventRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';

type Next = { title: string; text: string; label: string; route: string; Icon: LucideIcon; tone: 'organise' | 'money' | 'idea' | 'capsule' };
const NEXT: Record<NextAction, Next> = {
  invite: { title: 'Invite le groupe', text: 'Ajoute tes amis ou partage un lien.', label: 'Inviter', route: 'members', Icon: UserPlus, tone: 'organise' },
  propose: { title: 'Propose la première idée', text: 'Une photo, un prix, un lien : le groupe votera.', label: 'Proposer', route: 'idea/edit', Icon: Lightbulb, tone: 'idea' },
  vote: { title: 'Donne ta voix', text: 'Modifiable jusqu’à la clôture du vote.', label: 'Voir les idées', route: 'ideas', Icon: Vote, tone: 'organise' },
  select_gift: { title: 'Choisis le cadeau retenu', text: 'Le vote est clos : confirme le choix du groupe.', label: 'Voir le classement', route: 'ideas', Icon: Gift, tone: 'organise' },
  finish_task: { title: 'Termine ta mission', text: 'Coche-la quand c’est fait.', label: 'Mes missions', route: 'missions', Icon: ClipboardCheck, tone: 'organise' },
  write_capsule: { title: 'Écris ton mot', text: 'Un message, une photo, découverts le jour J.', label: 'Écrire', route: 'capsule', Icon: PenLine, tone: 'capsule' },
  claim_task: { title: 'Donne un coup de main', text: 'Des missions attendent quelqu’un.', label: 'Voir les missions', route: 'missions', Icon: ClipboardCheck, tone: 'organise' },
  // Formulation neutre : participer reste libre, sans montant suggéré ni rappel insistant.
  contribute: { title: 'La cagnotte est ouverte', text: 'Participe si tu le souhaites, du montant de ton choix.', label: 'Participer', route: 'contribute', Icon: Coins, tone: 'money' },
  wait_reveal: { title: 'Tout est prêt de ton côté', text: 'Merci ! Rendez-vous le jour J.', label: 'Voir la capsule', route: 'capsule', Icon: Hourglass, tone: 'idea' },
  open_capsule: { title: 'Ta capsule est ouverte', text: 'Des mots, des photos et un cadeau t’attendent.', label: 'Découvrir', route: 'capsule', Icon: PartyPopper, tone: 'capsule' },
  view_memories: { title: 'Revivre les souvenirs', text: 'Les mots, les photos et le cadeau.', label: 'Ouvrir la capsule', route: 'capsule', Icon: PartyPopper, tone: 'capsule' },
};
/** Organisation = encre (aubergine), argent = corail, idée = soleil, capsule = nuit. */
const TONE = {
  organise: { bg: colors.ink, fg: colors.white, sub: colors.nightSub, chip: 'rgba(255,255,255,0.12)' },
  money: { bg: colors.coralDark, fg: colors.white, sub: colors.coralSoft, chip: 'rgba(255,255,255,0.18)' },
  idea: { bg: colors.sun, fg: colors.ink, sub: colors.sunInk, chip: 'rgba(36,18,61,0.08)' },
  capsule: { bg: colors.night, fg: colors.white, sub: colors.nightSub, chip: 'rgba(255,255,255,0.12)' },
};

export default function EventHome() {
  const id = useEventId();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
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
  if (event.isError) return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}><ErrorState error={event.error} onRetry={() => event.refetch()} /></View>;
  if (!event.data || !progress.data) {
    return (
      <View style={{ flex: 1, padding: gutter, paddingTop: insets.top + gutter, gap: space.lg, backgroundColor: colors.bg }}>
        <Banner tone="error" title="Cagnotte introuvable">Elle n’existe plus ou tu n’en fais plus partie.</Banner>
        <Button label="Retour à l’accueil" onPress={() => router.replace('/events')} />
      </View>
    );
  }

  const e = event.data;
  const p = progress.data;
  const isManager = p.my_role === 'organizer' || p.my_role === 'co_organizer';
  const preparers = (members.data ?? []).filter((m) => m.role !== 'beneficiary');
  const next = NEXT[p.next_action];
  const go = (route: string) => router.push(`/event/${id}/${route === 'index' ? '' : route}` as never);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: space.huge }}
        refreshControl={
          <RefreshControl
            refreshing={event.isRefetching}
            tintColor={colors.coral}
            progressViewOffset={insets.top}
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
        {/* Couverture pleine largeur, actions posées dessus */}
        <View>
          <EventCover event={e} style={{ width: '100%', height: 196 + insets.top }} />
          <View style={{ position: 'absolute', top: insets.top + space.sm, left: gutter, right: gutter, flexDirection: 'row', justifyContent: 'space-between' }}>
            <HeaderAction variant="cover" label="Retour à l’accueil" onPress={() => (router.canGoBack() ? router.back() : router.replace('/events'))}>
              <ChevronLeft size={24} color={colors.ink} strokeWidth={2.25} />
            </HeaderAction>
            {isManager ? (
              <HeaderAction variant="cover" label="Réglages de la cagnotte" onPress={() => go('settings')}>
                <Settings2 size={21} color={colors.ink} strokeWidth={2} />
              </HeaderAction>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: -28, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.bg, paddingHorizontal: gutter, paddingTop: space.xl, gap: space.xxl }}>
          <View style={{ gap: space.sm }}>
            <T v="overline" color={colors.coralInk}>
              {e.occasion} · {formatEventDate(e.gift_at, e.timezone, false)}
            </T>
            <T v="display" accessibilityRole="header">
              {e.title}
            </T>
            {!isBeneficiary ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Le groupe : ${preparers.length} membre${preparers.length > 1 ? 's' : ''}`} onPress={() => go('members')} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                <Row gap={space.sm}>
                  <AvatarPile people={preparers.map((m) => ({ id: m.user_id, name: m.profiles?.display_name ?? '?', path: m.profiles?.avatar_path }))} size={30} />
                  <T v="label" color={colors.inkSoft}>
                    {preparers.length} pour {e.beneficiary_name}
                  </T>
                  <ArrowRight size={16} color={colors.inkSoft} />
                </Row>
              </Pressable>
            ) : null}
          </View>

          {params.created === '1' ? (
            <Banner tone="info" title="Ta cagnotte est prête !" icon={<Mascot size={36} mood="wink" />}>
              Invite le groupe : tes amis en deux touches, ou un lien.
            </Banner>
          ) : params.welcome === '1' ? (
            <Banner tone="info" title="Bienvenue dans le groupe" icon={<Mascot size={36} />}>
              {`${e.beneficiary_name} ne voit rien avant l’ouverture.`}
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
                    <Button variant="white" compact label="Participer" iconRight={<ArrowRight size={18} color={colors.coralInk} />} onPress={() => go('contribute')} style={{ alignSelf: 'flex-start' }} />
                  ) : null}
                </FundingCard>
              ) : funding.isError ? (
                <ErrorState error={funding.error} onRetry={() => funding.refetch()} />
              ) : (
                <Skeleton height={220} radius={radius.cover} />
              )}

              <Section title="Le cadeau">
                <GiftBlock event={e} progress={p} isManager={isManager} gift={gift.data ?? null} onGo={go} />
              </Section>

              <Section title="Échéances">
                <Deadlines
                  timezone={e.timezone}
                  items={[
                    { key: 'votes', label: 'Fin du vote', iso: e.votes_close_at },
                    { key: 'contrib', label: 'Fin des participations', iso: e.contributions_close_at },
                    { key: 'gift', label: 'Remise du cadeau', iso: e.gift_at },
                    { key: 'reveal', label: 'Ouverture de la capsule', iso: e.reveal_at },
                  ]}
                />
              </Section>

              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.xl }}>
                <Preparations progress={p} giftAt={e.gift_at} timezone={e.timezone} onOpen={go} />
              </View>

              <Section title="Mes timbres" aside={<MyStampsCount eventId={id} me={session?.user.id} />}>
                <MyStamps eventId={id} me={session?.user.id} />
              </Section>

              <Section title="Le journal">
                {activity.isPending ? <Skeleton height={60} /> : activity.isError ? <ErrorState error={activity.error} onRetry={() => activity.refetch()} /> : <Journal rows={activity.data ?? []} />}
              </Section>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Section sans carte : titre, contenu, filet de séparation. */
function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.xl }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h1" accessibilityRole="header">
          {title}
        </T>
        {aside}
      </Row>
      {children}
    </View>
  );
}

function NextCard({ next, onPress }: { next: Next; onPress: () => void }) {
  const t = TONE[next.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Prochaine étape pour toi : ${next.title}. ${next.label}`}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: t.bg, borderRadius: radius.cover, padding: space.xl, flexDirection: 'row', gap: space.lg, alignItems: 'center', transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
        <next.Icon size={26} color={t.fg} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="overline" color={t.sub}>
          Ta prochaine étape
        </T>
        <T v="h2" color={t.fg}>
          {next.title}
        </T>
        <T v="small" color={t.sub}>
          {next.text}
        </T>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.fg, alignItems: 'center', justifyContent: 'center' }}>
        <ArrowRight size={20} color={t.bg} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

/** Le cadeau : choisi (visuel + action), à décider, ou vote en cours — l'état réel et l'action attendue. */
function GiftBlock({ event: e, progress: p, isManager, gift, onGo }: { event: EventRow; progress: EventProgress; isManager: boolean; gift: { title: string; description: string | null; image_path: string | null } | null; onGo: (r: string) => void }) {
  if (gift) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Cadeau retenu : ${gift.title}. Voir les idées`} onPress={() => onGo('ideas')} style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
        {gift.image_path ? (
          <PrivateImage path={gift.image_path} style={{ width: 88, height: 88, borderRadius: radius.field }} label={`Photo de ${gift.title}`} />
        ) : (
          <View style={{ width: 88, height: 88, borderRadius: radius.field, backgroundColor: colors.sunSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={34} color={colors.sunInk} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.mint, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 3 }}>
            <T v="small" color={colors.success} style={{ fontFamily: fonts.bold }}>
              Choisi par le groupe
            </T>
          </View>
          <T v="h2" numberOfLines={2}>
            {gift.title}
          </T>
          <T v="label" style={{ textDecorationLine: 'underline', textDecorationColor: colors.sun }}>
            Voir les détails →
          </T>
        </View>
      </Pressable>
    );
  }
  const votesOpen = p.votes_open;
  const state = votesOpen
    ? p.proposals === 0
      ? { title: 'Aucune idée pour l’instant', text: 'Lance le vote avec une première idée.', cta: 'Proposer une idée', route: 'idea/edit' }
      : { title: `Vote en cours · ${p.proposals} idée${p.proposals > 1 ? 's' : ''}`, text: p.voted ? 'Ta voix est enregistrée. Tu peux encore la changer.' : 'Tu n’as pas encore voté.', cta: p.voted ? 'Voir le classement' : 'Voter', route: 'ideas' }
    : isManager
      ? { title: 'Décision à prendre', text: 'Le vote est clos : confirme le cadeau retenu.', cta: 'Choisir le cadeau', route: 'ideas' }
      : { title: 'Le vote est clos', text: 'L’organisation confirme le cadeau retenu.', cta: 'Voir le classement', route: 'ideas' };
  return (
    <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
      <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.sunSoft, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] }}>
        {votesOpen ? <Vote size={26} color={colors.sunInk} /> : <Gift size={26} color={colors.sunInk} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h2">{state.title}</T>
        <T v="small" color={colors.inkSoft}>
          {votesOpen ? `${state.text} Clôture le ${formatEventDate(e.votes_close_at, e.timezone, false)}.` : state.text}
        </T>
        <TextLink label={state.cta} onPress={() => onGo(state.route)} />
      </View>
    </View>
  );
}

function useMyStamps(eventId: string, me?: string) {
  const badges = useBadges(eventId);
  const mine = new Set<BadgeKind>((badges.data ?? []).filter((b) => b.user_id === me && STAMP_ORDER.includes(b.badge)).map((b) => b.badge));
  const helpers = new Set((badges.data ?? []).filter((b) => b.user_id !== me && STAMP_ORDER.includes(b.badge)).map((b) => b.user_id)).size;
  return { mine, helpers };
}

function MyStampsCount({ eventId, me }: { eventId: string; me?: string }) {
  const { mine } = useMyStamps(eventId, me);
  return (
    <T v="label" color={colors.inkSoft}>
      {mine.size}/{STAMP_ORDER.length}
    </T>
  );
}

/** Mes timbres : un par geste réel (idée, voix, mission, mot), attribué une seule fois par la base. */
function MyStamps({ eventId, me }: { eventId: string; me?: string }) {
  const { mine, helpers } = useMyStamps(eventId, me);
  return (
    <View style={{ gap: space.sm }}>
      <StampShelf earned={mine} />
      <T v="small" color={colors.inkSoft}>
        {mine.size === STAMP_ORDER.length
          ? 'Collection complète : merci pour ton aide à chaque étape.'
          : helpers > 0
            ? `${helpers} autre${helpers > 1 ? 's' : ''} membre${helpers > 1 ? 's ont' : ' a'} déjà aidé. Touche un timbre pour savoir comment le gagner.`
            : 'Touche un timbre pour savoir comment le gagner.'}
      </T>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, gap: space.lg }}>
      <Skeleton height={220} radius={0} />
      <View style={{ paddingHorizontal: gutter, gap: space.lg }}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={32} width="80%" />
        <Skeleton height={110} radius={radius.cover} />
        <Skeleton height={220} radius={radius.cover} />
      </View>
    </View>
  );
}
