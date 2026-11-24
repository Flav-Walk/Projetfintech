import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, RefreshCw, WifiOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/avatar';
import { HeaderAction } from '@/components/headers';
import { PrivateImage } from '@/components/private-image';
import { SealedCapsule, type SealedCapsuleHandle } from '@/components/sealed-capsule';
import { Loading } from '@/components/states';
import { ThanksCard } from '@/components/thanks-card';
import { Button, T, TextLink } from '@/components/ui';
import { useCapsuleEntries, useThanks } from '@/lib/capsule';
import { formatEventDate } from '@/lib/format';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { countdownParts, useBeneficiaryCapsule, useCountdown, useMarkCapsuleOpened, type BeneficiaryCapsule } from '@/lib/surprise';
import type { CapsuleEntryRow } from '@/lib/types';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';

/**
 * Espace de la personne fêtée : uniquement sa capsule. Pas d'onglets de préparateurs.
 * Scellée → prête (à l'heure serveur) → ouverture animée (une fois, passable) → mots, photos, merci.
 */
export default function Surprise() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cap = useBeneficiaryCapsule(id);
  const data = cap.data ?? null;
  const offline = cap.isError && !!data;

  if (cap.isPending) return <Loading />;
  if (!data) {
    return (
      <Shell>
        {cap.isError ? (
          <Notice icon={<WifiOff size={28} color={colors.inkSoft} />} title="Pas de connexion" text="Ta capsule s’affichera dès le retour du réseau." action={{ label: 'Réessayer', onPress: () => cap.refetch() }} />
        ) : (
          <Notice title="Cette surprise n’est pas pour ce compte" text="Elle est réservée à la personne invitée avec cette adresse." action={{ label: 'Retour à l’accueil', onPress: () => router.replace('/events') }} />
        )}
      </Shell>
    );
  }
  if (data.state === 'cancelled') {
    return (
      <Shell>
        <Notice title="Cette surprise a été annulée" text="L’organisation a arrêté les préparatifs." action={{ label: 'Retour à l’accueil', onPress: () => router.replace('/events') }} />
      </Shell>
    );
  }
  return <Capsule data={data} offline={offline} onRetry={() => cap.refetch()} refreshing={cap.isRefetching} />;
}

function Capsule({ data, offline, onRetry, refreshing }: { data: BeneficiaryCapsule & { offset: number }; offline: boolean; onRetry: () => void; refreshing: boolean }) {
  const id = data.event_id;
  const reduce = useReducedMotion();
  const open = data.state === 'open';
  const entries = useCapsuleEntries(id, open);
  const mark = useMarkCapsuleOpened(id);
  const [phase, setPhase] = useState<'idle' | 'opening' | 'done'>('idle');
  const [replay, setReplay] = useState(false);
  const list = entries.data ?? [];
  const empty = open && entries.isSuccess && list.length === 0;

  // Capsule ouverte mais vide : pas de mise en scène qui promettrait une surprise ; l'ouverture est notée.
  useEffect(() => {
    if (empty && !data.opened_at && !mark.isPending && !mark.isSuccess) mark.mutate();
  }, [empty, data.opened_at, mark]);

  const showContent = open && !replay && (phase === 'done' || (!!data.opened_at && phase === 'idle') || empty);
  if (open && entries.isPending) return <Loading />;
  if (showContent) {
    return <Memories data={data} entries={list} animate={phase === 'done' && !reduce} onReplay={list.length ? () => (setReplay(true), setPhase('idle')) : undefined} onRefresh={() => entries.refetch()} refreshing={entries.isRefetching} />;
  }
  return (
    <Stage
      data={data}
      offline={offline}
      onRetry={onRetry}
      refreshing={refreshing}
      phase={phase}
      autoOpen={replay}
      onOpen={() => {
        setPhase('opening');
        if (!data.opened_at) mark.mutate();
      }}
      onDone={() => {
        setReplay(false);
        setPhase('done');
      }}
    />
  );
}

// ------------------------------------------------------------------ Scellée / prête / ouverture
function Stage({
  data,
  offline,
  onRetry,
  refreshing,
  phase,
  autoOpen,
  onOpen,
  onDone,
}: {
  data: BeneficiaryCapsule & { offset: number };
  offline: boolean;
  onRetry: () => void;
  refreshing: boolean;
  phase: 'idle' | 'opening' | 'done';
  autoOpen: boolean;
  onOpen: () => void;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const ref = useRef<SealedCapsuleHandle>(null);
  const sealed = data.state === 'sealed';
  const left = useCountdown(data.event_id, data.reveal_at, data.offset, sealed);
  const [nudge, setNudge] = useState(false);
  const capW = Math.min(width - gutter * 2, 320);
  const date = formatEventDate(data.reveal_at, data.timezone);

  const start = () => {
    onOpen();
    if (!reduce) setTimeout(hapticSuccess, 380);
    ref.current?.open(onDone);
  };
  useEffect(() => {
    if (autoOpen && !sealed) {
      const t = setTimeout(start, 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, sealed]);
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(false), 2600);
    return () => clearTimeout(t);
  }, [nudge]);

  return (
    <Shell refresh={<RefreshControl refreshing={refreshing} onRefresh={onRetry} tintColor={colors.coral} />}>
      {offline ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.sand, borderRadius: radius.field, padding: space.md }}>
          <WifiOff size={18} color={colors.ink} />
          <T v="small" style={{ flex: 1 }}>
            Hors connexion : l’ouverture sera vérifiée au retour du réseau.
          </T>
          <RefreshCw size={16} color={colors.ink} />
        </Pressable>
      ) : null}
      <View style={{ gap: 6 }}>
        <T v="small" color={colors.coralInk} style={{ fontFamily: fonts.extraBold }}>
          {sealed ? 'Une surprise pour toi' : 'C’est le jour J'}
        </T>
        <T v="display" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 36 }}>
          {sealed ? 'Ta capsule est scellée' : 'Ta capsule est prête'}
        </T>
        <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
          {data.organizer_name ? `Préparée par ${data.organizer_name} et tes proches` : 'Préparée par tes proches'}
        </T>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sealed ? `Capsule scellée. Elle s’ouvre le ${date}.` : 'Capsule prête à être ouverte'}
        accessibilityHint={sealed ? undefined : 'Ouvre ta capsule'}
        disabled={phase === 'opening'}
        onPress={() => {
          if (sealed) {
            hapticTap();
            ref.current?.wiggle();
            setNudge(true);
          } else if (phase === 'idle') start();
        }}
        style={{ alignItems: 'center', paddingTop: space.xxl, paddingBottom: space.sm }}
      >
        <SealedCapsule ref={ref} width={capW} state={sealed ? 'sealed' : 'ready'} reduce={reduce} />
      </Pressable>

      {sealed ? (
        <View style={{ alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={`Ouverture le ${date}`}>
          <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.extraBold, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {left === 0 ? 'C’est l’heure' : 'Ouverture dans'}
          </T>
          {left === 0 ? (
            <T v="label" color={colors.inkSoft} accessibilityLiveRegion="polite">
              Vérification de l’ouverture…
            </T>
          ) : (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {countdownParts(left).map((p) => (
                <View key={p.unit} style={{ minWidth: 72, alignItems: 'center', paddingVertical: space.sm, paddingHorizontal: space.sm, backgroundColor: colors.surface, borderRadius: radius.field, borderWidth: 1, borderColor: colors.border }}>
                  <T v="money" style={{ fontSize: 30, lineHeight: 34 }} maxFontSizeMultiplier={1.3}>
                    {p.value}
                  </T>
                  <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
                    {p.unit}
                  </T>
                </View>
              ))}
            </View>
          )}
          <T v="label" color={colors.ink} style={{ textAlign: 'center' }}>
            Le {date}
          </T>
          <T v="small" color={colors.coralInk} accessibilityLiveRegion="polite" style={{ minHeight: 18, textAlign: 'center', fontFamily: fonts.bold, opacity: nudge ? 1 : 0 }}>
            {nudge ? 'Encore un peu de patience : elle s’ouvrira à cette date.' : ' '}
          </T>
        </View>
      ) : phase === 'opening' ? (
        <Button variant="ghost" label="Passer l’animation" onPress={() => (ref.current?.finish(), onDone())} />
      ) : (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(320).delay(500)} style={{ gap: space.sm }}>
          <Button label="Ouvrir ma capsule" onPress={start} />
        </Animated.View>
      )}
    </Shell>
  );
}

// ------------------------------------------------------------------ Après l'ouverture
function Memories({ data, entries, animate, onReplay, onRefresh, refreshing }: { data: BeneficiaryCapsule; entries: CapsuleEntryRow[]; animate: boolean; onReplay?: () => void; onRefresh: () => void; refreshing: boolean }) {
  const thanks = useThanks(data.event_id, true);
  const photos = entries.filter((e) => e.photo_path);
  const [viewer, setViewer] = useState<number | null>(null);
  const authors = new Set(entries.map((e) => e.author_id)).size;
  return (
    <Shell refresh={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}>
      <View style={{ gap: 6 }}>
        <T v="small" color={colors.coralInk} style={{ fontFamily: fonts.extraBold }}>
          Ta capsule
        </T>
        <T v="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34 }}>
          {data.title ?? 'Tes souvenirs'}
        </T>
        <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
          {entries.length === 0
            ? `Ouverte le ${formatEventDate(data.reveal_at, data.timezone, false)}`
            : `${authors} proche${authors > 1 ? 's' : ''} · ${entries.filter((e) => e.body).length} mot${entries.filter((e) => e.body).length > 1 ? 's' : ''}${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? 's' : ''}` : ''}`}
        </T>
      </View>

      {entries.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.xl, gap: space.sm }}>
          <T v="h2">Ta capsule ne contient pas de mot</T>
          <T color={colors.inkSoft}>Aucun mot ni aucune photo n’a été déposé avant l’ouverture.</T>
        </View>
      ) : (
        entries.map((e, i) => (
          <Animated.View key={e.id} entering={animate ? FadeInDown.duration(380).delay(i * 110) : undefined}>
            <Letter entry={e} index={i} onPhoto={() => setViewer(photos.findIndex((p) => p.id === e.id))} />
          </Animated.View>
        ))
      )}

      {photos.length > 1 ? (
        <View style={{ gap: space.md }}>
          <T v="h2" accessibilityRole="header">
            Les photos
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {photos.map((p, i) => (
              <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel={`Photo de ${p.profiles?.display_name ?? 'un proche'}, agrandir`} onPress={() => setViewer(i)} style={{ width: '31.5%', aspectRatio: 1 }}>
                <PrivateImage path={p.photo_path} style={{ width: '100%', height: '100%', borderRadius: radius.field }} label={`Photo de ${p.profiles?.display_name ?? 'un proche'}`} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <ThanksCard eventId={data.event_id} beneficiaryName="" canWrite thanks={thanks.data ?? null} loading={thanks.isPending} />
      {onReplay ? <TextLink label="Revoir l’ouverture" onPress={onReplay} /> : null}
      {viewer !== null ? <PhotoViewer key={viewer} photos={photos} index={viewer} onClose={() => setViewer(null)} /> : null}
    </Shell>
  );
}

/** Un mot : une lettre de papier légèrement inclinée, l'écriture manuscrite, la photo et la signature. */
function Letter({ entry: e, index, onPhoto }: { entry: CapsuleEntryRow; index: number; onPhoto: () => void }) {
  const name = e.profiles?.display_name ?? 'Un proche';
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md, transform: [{ rotate: index % 2 ? '0.6deg' : '-0.6deg' }] }}>
      {e.photo_path ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Photo de ${name}, agrandir`} onPress={onPhoto}>
          <PrivateImage path={e.photo_path} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.field }} label={`Photo de ${name}`} />
        </Pressable>
      ) : null}
      {e.body ? <T v="hand">{e.body}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-end' }}>
        <UserAvatar name={name} seed={e.author_id} size={28} ring={null} />
        <T v="label" color={colors.inkSoft}>
          {name}
        </T>
      </View>
    </View>
  );
}

function PhotoViewer({ photos, index, onClose }: { photos: CapsuleEntryRow[]; index: number | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(index ?? 0);
  if (index === null || index < 0) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: gutter, gap: space.md }}>
          <T v="label" color={colors.nightSub} style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {page + 1} / {photos.length} · {photos[page]?.profiles?.display_name ?? ''}
          </T>
          <HeaderAction variant="cover" label="Fermer" onPress={onClose}>
            <X size={20} color={colors.ink} />
          </HeaderAction>
        </View>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {photos.map((p) => (
            <View key={p.id} style={{ width, height: height * 0.75, alignItems: 'center', justifyContent: 'center', padding: gutter }}>
              <PrivateImage path={p.photo_path} style={{ width: '100%', height: '100%', borderRadius: radius.card }} label={`Photo de ${p.profiles?.display_name ?? 'un proche'}`} contentFit="contain" />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ------------------------------------------------------------------ Cadre commun
function Shell({ children, refresh }: { children: React.ReactNode; refresh?: React.ReactElement<React.ComponentProps<typeof RefreshControl>> }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: space.huge, gap: space.xl }} refreshControl={refresh}>
        <View style={{ flexDirection: 'row' }}>
          <HeaderAction label="Retour à l’accueil" onPress={() => (router.canGoBack() ? router.back() : router.replace('/events'))}>
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2.25} />
          </HeaderAction>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Notice({ title, text, action, icon }: { title: string; text: string; action: { label: string; onPress: () => void }; icon?: React.ReactNode }) {
  return (
    <View style={{ gap: space.md, paddingTop: space.xl }}>
      {icon ?? null}
      <T v="h1">{title}</T>
      <T color={colors.inkSoft}>{text}</T>
      <Button variant="outline" label={action.label} onPress={action.onPress} />
    </View>
  );
}
