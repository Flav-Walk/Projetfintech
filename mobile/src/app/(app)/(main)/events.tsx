import { messageFor, ROLE_LABELS, type EventFundingSummary, type ReceivedInvite, type SurpriseRow } from '@complice/shared';
import { router } from 'expo-router';
import { CalendarDays, Gift, Link2, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/avatar';
import { FundingMini } from '@/components/event-parts';
import { HeaderMeta, ScreenHeader } from '@/components/headers';
import { Segmented, SkeletonList } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { EventCover } from '@/components/event-cover';
import { ErrorState } from '@/components/states';
import { Button, Chip, Row, T } from '@/components/ui';
import { formatEventDate, timeUntil } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';
import { useMyEvents, useMyEventsFunding, useProfile, type MyEvent } from '@/lib/queries';
import { useReceivedInvites, useRespondInvite, useSurprises } from '@/lib/social';
import { useToast } from '@/lib/toast';
import { useNow } from '@/lib/use-now';
import { colors, fonts, gutter, radius, shadow, space } from '@/theme/tokens';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
}

/** « Mardi 24 novembre » */
function todayLabel(now: number) {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(now));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Home() {
  const events = useMyEvents();
  const funding = useMyEventsFunding();
  const profile = useProfile();
  const invites = useReceivedInvites();
  const surprises = useSurprises();
  const [tab, setTab] = useState<'current' | 'memories'>('current');
  const now = useNow();

  const { current, memories } = useMemo(() => {
    const list = events.data ?? [];
    const isMemory = (e: MyEvent) => e.event.status !== 'active' || new Date(e.event.reveal_at).getTime() <= now;
    return { current: list.filter((e) => !isMemory(e)), memories: list.filter(isMemory).reverse() };
  }, [events.data, now]);
  const shown = tab === 'current' ? current : memories;

  const refresh = () => {
    void events.refetch();
    void funding.refetch();
    void invites.refetch();
    void surprises.refetch();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={refresh} tintColor={colors.coral} />}
      >
        <ScreenHeader
          eyebrow={todayLabel(now)}
          title={`${greeting()}${profile.data?.display_name ? ` ${profile.data.display_name}` : ''}`}
          meta={
            events.data ? (
              <HeaderMeta
                dot={(invites.data ?? []).length ? colors.coral : undefined}
                text={[
                  current.length ? `${current.length} cagnotte${current.length > 1 ? 's' : ''} en cours` : 'Aucune cagnotte en cours',
                  (invites.data ?? []).length ? `${invites.data!.length} invitation${invites.data!.length > 1 ? 's' : ''}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ) : undefined
          }
          aside={
            <Pressable accessibilityRole="button" accessibilityLabel="Mon profil" onPress={() => router.push('/profile')} hitSlop={4}>
              <UserAvatar name={profile.data?.display_name ?? '?'} path={profile.data?.avatar_path} seed={profile.data?.id} size={48} />
            </Pressable>
          }
        />

        {(invites.data ?? []).length > 0 ? (
          <View style={{ gap: space.md }}>
            <T v="overline" color={colors.coralInk}>
              {invites.data!.length > 1 ? `${invites.data!.length} invitations pour toi` : 'Une invitation pour toi'}
            </T>
            {invites.data!.map((inv) => (
              <Animated.View key={inv.id} entering={FadeInDown.duration(220)} layout={LinearTransition}>
                <InviteCard invite={inv} />
              </Animated.View>
            ))}
          </View>
        ) : null}

        {(surprises.data ?? []).map((s) => (
          <SurpriseCard key={s.event_id} surprise={s} />
        ))}

        <Segmented
          label="Mes cagnottes"
          value={tab}
          onChange={setTab}
          options={[
            { key: 'current', label: 'En cours', count: current.length || undefined },
            { key: 'memories', label: 'Souvenirs', count: memories.length || undefined },
          ]}
        />

        {events.isPending ? (
          <SkeletonList rows={3} />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} />
        ) : shown.length === 0 ? (
          tab === 'current' ? (
            <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
              <Mascot size={110} mood="wink" />
              <T v="h2" style={{ textAlign: 'center' }}>
                Un cadeau à préparer ?
              </T>
              <T color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 320 }}>
                Crée une cagnotte en une minute, invite tes amis, et décidez ensemble du cadeau.
              </T>
              <Button label="Créer une cagnotte" icon={<Plus size={20} color={colors.white} strokeWidth={2.25} />} onPress={() => router.push('/create')} style={{ alignSelf: 'stretch' }} />
              <Button label="J’ai un lien d’invitation" variant="ghost" icon={<Link2 size={18} color={colors.ink} />} onPress={() => router.push('/join')} />
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
              <Mascot size={96} mood="calm" />
              <T v="h3" style={{ textAlign: 'center' }}>
                Pas encore de souvenirs
              </T>
              <T color={colors.inkSoft} style={{ textAlign: 'center', maxWidth: 320 }}>
                Après l’ouverture de la capsule, chaque cagnotte rejoint tes souvenirs avec ses mots et ses photos.
              </T>
            </View>
          )
        ) : (
          shown.map((e, i) => (
            <Animated.View key={e.event.id} entering={FadeInDown.delay(Math.min(i, 5) * 50).duration(220)}>
              <EventCard item={e} funding={funding.data?.get(e.event.id)} memory={tab === 'memories'} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InviteCard({ invite }: { invite: ReceivedInvite }) {
  const respond = useRespondInvite();
  const toast = useToast();
  const surprise = invite.role === 'beneficiary';
  const from = invite.inviter_name ?? 'Un proche';
  async function answer(accept: boolean) {
    try {
      const r = await respond.mutateAsync({ id: invite.id, accept });
      if (accept && (r.status === 'joined' || r.status === 'already_member')) {
        hapticSuccess();
        if (surprise) toast.show({ text: 'C’est noté : rendez-vous le jour J !', tone: 'success' });
        else if (r.event_id) router.push({ pathname: '/event/[id]', params: { id: r.event_id, welcome: '1' } });
      } else if (!accept) {
        toast.show({ text: 'Invitation refusée', tone: 'info' });
      } else {
        toast.show({ text: r.status === 'expired' ? 'Cette invitation a expiré.' : r.status === 'removed' ? 'Tu as été retiré·e de ce groupe.' : 'Cette invitation n’est plus valable.', tone: 'error' });
      }
    } catch (e) {
      toast.show({ text: messageFor(e), tone: 'error' });
    }
  }
  return (
    <View style={[{ backgroundColor: surprise ? colors.night : colors.surface, borderRadius: radius.card, padding: space.lg, gap: space.md, borderWidth: surprise ? 0 : 1, borderColor: colors.border }, shadow.card]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <UserAvatar name={from} path={invite.inviter_avatar} size={44} ring={surprise ? colors.night : colors.white} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="bodyBold" color={surprise ? colors.white : colors.ink}>
            {surprise ? `${from} te prépare une surprise` : `${from} t’invite`}
          </T>
          <T v="small" color={surprise ? colors.nightSub : colors.inkSoft}>
            {surprise
              ? 'Tu ne verras rien avant le jour J : ni le cadeau, ni les mots, ni la cagnotte.'
              : `« ${invite.title} »${invite.gift_at ? ` · ${formatEventDate(invite.gift_at, undefined, false)}` : ''}${invite.member_count ? ` · ${invite.member_count} membre${invite.member_count > 1 ? 's' : ''}` : ''}`}
          </T>
          {invite.source === 'email' ? (
            <T v="small" color={surprise ? colors.nightSub : colors.inkFaint}>
              Reçue par e-mail
            </T>
          ) : null}
        </View>
      </Row>
      <Row gap={space.sm}>
        <Button compact variant={surprise ? 'white' : 'outline'} label="Refuser" onPress={() => answer(false)} style={{ flex: 1 }} disabled={respond.isPending} />
        <Button compact label={surprise ? 'Accepter' : 'Rejoindre'} onPress={() => answer(true)} style={{ flex: 1 }} loading={respond.isPending && respond.variables?.accept === true} />
      </Row>
    </View>
  );
}

function SurpriseCard({ surprise }: { surprise: SurpriseRow }) {
  const now = useNow();
  return (
    <View style={{ backgroundColor: colors.night, borderRadius: radius.card, padding: space.xl, flexDirection: 'row', alignItems: 'center', gap: space.lg, overflow: 'hidden' }} accessible accessibilityLabel={`Une surprise se prépare pour toi. Ouverture ${formatEventDate(surprise.reveal_at)}.`}>
      <Mascot size={72} mood="wink" />
      <View style={{ flex: 1, gap: 4 }}>
        <T v="overline" color={colors.sun}>
          Chut… surprise
        </T>
        <T v="h3" color={colors.white}>
          Tes proches te préparent quelque chose
        </T>
        <T v="small" color={colors.nightSub}>
          Ouverture le {formatEventDate(surprise.reveal_at)} · {timeUntil(surprise.reveal_at, now)}
          {surprise.organizer_name ? ` · avec ${surprise.organizer_name}` : ''}
        </T>
      </View>
    </View>
  );
}

function EventCard({ item, funding, memory }: { item: MyEvent; funding?: EventFundingSummary; memory: boolean }) {
  const e = item.event;
  const now = useNow();
  const preparer = item.role !== 'beneficiary';
  const soon = !memory && new Date(e.gift_at).getTime() - now < 7 * 86400000;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${e.title}, ${ROLE_LABELS[item.role]}${funding && preparer ? `, ${funding.percent} % de l’objectif` : ''}`}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: e.id } })}
      style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.cover, overflow: 'hidden', transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <View>
        <EventCover event={e} style={{ width: '100%', aspectRatio: memory ? 3 : 2.2 }} />
        {/* Échéance en étiquette, posée sur la couverture */}
        <View style={{ position: 'absolute', left: space.md, bottom: space.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: soon ? colors.coral : colors.white, borderRadius: radius.tag, paddingHorizontal: 10, paddingVertical: 5 }}>
          <CalendarDays size={14} color={soon ? colors.white : colors.ink} strokeWidth={2.25} />
          <T v="label" color={soon ? colors.white : colors.ink} maxFontSizeMultiplier={1.3}>
            {memory ? `Ouverte le ${formatEventDate(e.reveal_at, e.timezone, false)}` : `${formatEventDate(e.gift_at, e.timezone, false)} · ${timeUntil(e.gift_at, now)}`}
          </T>
        </View>
        {item.role === 'beneficiary' ? (
          <View style={{ position: 'absolute', right: space.md, top: space.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sunSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Gift size={18} color={colors.sunInk} />
          </View>
        ) : item.role === 'organizer' ? (
          <View style={{ position: 'absolute', right: space.md, top: space.md, backgroundColor: colors.ink, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 4 }}>
            <T v="small" color={colors.white} style={{ fontFamily: fonts.bold }} maxFontSizeMultiplier={1.2}>
              Tu organises
            </T>
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md }}>
        <T v="h2" numberOfLines={2}>
          {e.title}
        </T>
        {preparer && funding && !memory ? <FundingMini collected={funding.collected_cents} target={funding.target_cents} percent={funding.percent} goalReached={funding.goal_reached} /> : null}
        {e.is_demo ? <Chip label="Démo" tone="sun" /> : null}
      </View>
    </Pressable>
  );
}
