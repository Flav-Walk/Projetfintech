import { messageFor, type CapsuleStatus } from '@complice/shared';
import { BookOpen, CircleHelp, Eye, Gift, HeartHandshake, ImagePlus, LockKeyhole, Mail, PenLine, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { Sheet } from '@/components/kit';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmButton } from '@/components/confirm-button';
import { Mascot } from '@/components/mascot';
import { PrivateImage } from '@/components/private-image';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCapsuleEntries, useCapsuleStats, useDeleteEntry, useMyEntry, useSaveEntry, useSaveThanks, useThanks } from '@/lib/capsule';
import { formatEventDate, timeUntil } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';
import { draftKey, useLocalDraft } from '@/lib/local-drafts';
import { pickImage, uploadImage, type PickedImage } from '@/lib/media';
import { useEvent, useProgress, useRevealedGift } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { CapsuleEntryRow, EventRow, ThanksRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, fonts, gutter, radius, space, type } from '@/theme/tokens';

export default function Capsule() {
  const id = useEventId();
  const event = useEvent(id);
  const progress = useProgress(id);
  const revealed = !!progress.data?.revealed;
  const isPreparer = !!progress.data && progress.data.my_role !== 'beneficiary';
  const mine = useMyEntry(id, isPreparer && !revealed);
  const stats = useCapsuleStats(id);
  const entries = useCapsuleEntries(id, revealed);
  const gift = useRevealedGift(id, revealed);
  const thanks = useThanks(id, revealed);
  const [story, setStory] = useState(false);
  const [help, setHelp] = useState(false);

  if (event.isPending || progress.isPending) return <Loading />;
  if (!event.data || !progress.data) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ErrorState error={event.error ?? progress.error} onRetry={() => event.refetch()} />
      </SafeAreaView>
    );
  }
  const e = event.data;

  if (revealed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.night }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.xxxl }}
          refreshControl={
            <RefreshControl
              refreshing={entries.isRefetching}
              tintColor={colors.sun}
              onRefresh={() => {
                void entries.refetch();
                void thanks.refetch();
              }}
            />
          }
        >
          <RevealHeader event={e} beneficiary={!isPreparer} count={entries.data?.length ?? 0} />
          {(entries.data ?? []).length > 0 ? (
            <Button label="Lire les mots un par un" variant="white" iconRight={<BookOpen size={20} color={colors.coral} />} onPress={() => setStory(true)} />
          ) : null}
          <MemoryStory visible={story} onClose={() => setStory(false)} entries={entries.data ?? []} beneficiary={!isPreparer} name={e.beneficiary_name} />
          {gift.data ? (
            <View style={{ backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
              <Row gap={space.sm}>
                <Gift size={22} color={colors.coral} strokeWidth={1.75} />
                <T v="label" color={colors.coralDark}>
                  {isPreparer ? 'Le cadeau offert' : 'Ton cadeau'}
                </T>
              </Row>
              {gift.data.image_path ? (
                <PrivateImage path={gift.data.image_path} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14 }} label={`Photo du cadeau : ${gift.data.title}`} />
              ) : null}
              <T v="h2">{gift.data.title}</T>
              {gift.data.description ? <T color={colors.inkSoft}>{gift.data.description}</T> : null}
            </View>
          ) : null}
          <ThanksCard eventId={e.id} beneficiaryName={e.beneficiary_name} canWrite={!isPreparer} thanks={thanks.data ?? null} loading={thanks.isPending} />
          {entries.isPending ? (
            <Loading />
          ) : entries.isError ? (
            <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
          ) : entries.data.length === 0 ? (
            <Card tone="lavender">
              <T>Aucun mot n’a été scellé dans cette capsule.</T>
            </Card>
          ) : (
            entries.data.map((x) => <MemoryCard key={x.id} entry={x} />)
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: gutter, gap: space.xl, paddingBottom: space.huge }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="display" accessibilityRole="header">
              La capsule
            </T>
            <Pressable accessibilityRole="button" accessibilityLabel="Comment marche la capsule ?" onPress={() => setHelp(true)} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <CircleHelp size={22} color={colors.ink} />
            </Pressable>
          </Row>
          <OpeningTicket event={e} photos={stats.data?.photos ?? 0} authors={stats.data?.authors ?? 0} />
          {!isPreparer ? null : mine.isPending ? (
            <Loading />
          ) : mine.isError ? (
            <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
          ) : (
            <EntryEditor key={mine.data?.id ?? 'new'} event={e} entry={mine.data} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <CapsuleHelp visible={help} onClose={() => setHelp(false)} event={e} />
    </SafeAreaView>
  );
}

/** Ticket d'ouverture : la date en grand, le compte à rebours réel, ce qui est déjà déposé (sans contenu). */
function OpeningTicket({ event, photos, authors }: { event: EventRow; photos: number; authors: number }) {
  const now = useNow();
  const d = new Date(event.reveal_at);
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fr-FR', { ...o, timeZone: event.timezone }).format(d);
  return (
    <View
      accessible
      accessibilityLabel={`La capsule s’ouvre le ${formatEventDate(event.reveal_at, event.timezone)}, ${timeUntil(event.reveal_at, now)}. ${authors} mot${authors > 1 ? 's' : ''} déposé${authors > 1 ? 's' : ''}.`}
      style={{ backgroundColor: colors.night, borderRadius: radius.cover, flexDirection: 'row', overflow: 'hidden' }}
    >
      <View style={{ width: 92, alignItems: 'center', justifyContent: 'center', paddingVertical: space.lg, borderRightWidth: 2, borderRightColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' }}>
        <T v="overline" color={colors.sun}>
          {fmt({ month: 'short' }).replace('.', '')}
        </T>
        <T v="money" color={colors.white} maxFontSizeMultiplier={1.2}>
          {fmt({ day: 'numeric' })}
        </T>
        <T v="small" color={colors.lavenderStrong}>
          {fmt({ hour: '2-digit', minute: '2-digit' })}
        </T>
      </View>
      {/* Encoches du ticket */}
      <View style={{ position: 'absolute', left: 82, top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg }} />
      <View style={{ position: 'absolute', left: 82, bottom: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.bg }} />
      <View style={{ flex: 1, padding: space.lg, gap: 4, justifyContent: 'center' }}>
        <Row gap={6}>
          <LockKeyhole size={15} color={colors.sun} strokeWidth={2.25} />
          <T v="overline" color={colors.sun}>
            {timeUntil(event.reveal_at, now)}
          </T>
        </Row>
        <T v="h2" color={colors.white}>
          La capsule s’ouvre le jour J
        </T>
        <T v="small" color={colors.lavenderStrong}>
          {authors === 0 ? 'Aucun mot déposé pour l’instant' : `${authors} mot${authors > 1 ? 's' : ''} déposé${authors > 1 ? 's' : ''}${photos ? ` · ${photos} photo${photos > 1 ? 's' : ''}` : ''}`}
        </T>
      </View>
    </View>
  );
}

/** Aide contextuelle : ce que voient les autres, brouillon ou déposé, jusqu'à quand on peut modifier. */
function CapsuleHelp({ visible, onClose, event }: { visible: boolean; onClose: () => void; event: EventRow }) {
  const items: [string, string][] = [
    ['Personne ne lit ton mot avant l’ouverture', 'Ni le groupe, ni l’organisation : seuls les compteurs (mots, photos) sont visibles.'],
    ['Brouillon', 'Gardé pour toi seul. Il ne sera pas dans la capsule tant que tu ne le déposes pas.'],
    ['Déposé', `Il fera partie de la capsule. Tu peux le modifier, le remettre en brouillon ou le supprimer jusqu’au ${formatEventDate(event.reveal_at, event.timezone)}.`],
    ['À l’ouverture', `${event.beneficiary_name} et le groupe découvrent tous les mots déposés. Ils ne sont plus modifiables.`],
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Comment marche la capsule ?">
      {items.map(([t, d]) => (
        <View key={t} style={{ gap: 2 }}>
          <T v="bodyBold">{t}</T>
          <T color={colors.inkSoft}>{d}</T>
        </View>
      ))}
    </Sheet>
  );
}

/** Remerciements : le bénéficiaire écrit un message au groupe ; le groupe le lit dans le souvenir. */
function ThanksCard({ eventId, beneficiaryName, canWrite, thanks, loading }: { eventId: string; beneficiaryName: string; canWrite: boolean; thanks: ThanksRow | null; loading: boolean }) {
  const save = useSaveThanks(eventId);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  if (loading) return null;
  if (!canWrite) {
    if (!thanks) return null;
    return (
      <View style={{ backgroundColor: colors.sunSoft, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
        <Row gap={space.sm}>
          <HeartHandshake size={22} color={colors.coralDark} strokeWidth={1.75} />
          <T v="label">Le mot de {beneficiaryName} pour le groupe</T>
        </Row>
        <T v="hand">{thanks.body}</T>
      </View>
    );
  }
  if (thanks && !editing) {
    return (
      <View style={{ backgroundColor: colors.sunSoft, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
        <T v="label">Ton merci au groupe</T>
        <T v="hand">{thanks.body}</T>
        {sent ? <T v="small" color={colors.success}>Envoyé : tout le groupe peut le lire.</T> : null}
        <Button compact variant="ghost" label="Modifier" onPress={() => (setText(thanks.body), setEditing(true), setSent(false))} />
      </View>
    );
  }
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
      <T v="h3">Un merci pour le groupe ?</T>
      <T v="small" color={colors.inkSoft}>
        Facultatif. Ton message apparaîtra dans ce souvenir pour toutes les personnes qui l’ont préparé.
      </T>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder="Merci à tous, c’est un super cadeau !"
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel="Ton message de remerciement"
        style={[type.body, { minHeight: 96, textAlignVertical: 'top', color: colors.ink, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: space.md }]}
      />
      {save.isError ? <Banner tone="error">{messageFor(save.error)}</Banner> : null}
      <Button
        variant="secondary"
        label="Envoyer mon merci"
        disabled={!text.trim()}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { body: text.trim(), exists: !!thanks },
            { onSuccess: () => (setEditing(false), setSent(true)) },
          )
        }
      />
    </View>
  );
}

function EntryEditor({ event, entry }: { event: EventRow; entry: CapsuleEntryRow | null }) {
  const { session } = useAuth();
  const save = useSaveEntry(event.id);
  const del = useDeleteEntry(event.id);
  // Texte en cours gardé sur ce téléphone jusqu'à l'enregistrement (navigation accidentelle, fermeture).
  const local = useLocalDraft(draftKey(session?.user.id, `capsule.${event.id}`), { body: entry?.body ?? '' });
  const body = local.value.body;
  const setBody = (v: string) => local.update({ body: v });
  const restoredUnsaved = local.hadDraft && body !== (entry?.body ?? '');
  const [photoPath, setPhotoPath] = useState<string | null>(entry?.photo_path ?? null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const status: CapsuleStatus = entry?.status ?? 'draft';
  const dirty = body !== (entry?.body ?? '') || photoPath !== (entry?.photo_path ?? null) || !!picked;
  const empty = !body.trim() && !photoPath && !picked;

  const persist = async (next: CapsuleStatus) => {
    if (!session) return;
    setError(null);
    setSaved(null);
    if (next === 'published' && empty) {
      setError('Ajoute un mot ou une photo avant de le déposer.');
      return;
    }
    setBusy(true);
    let path = photoPath;
    const previous = entry?.photo_path ?? null;
    try {
      if (picked) path = await uploadImage('event-media', `${event.id}/capsule/${session.user.id}`, picked);
      await save.mutateAsync({ id: entry?.id ?? null, body: body.trim() || null, photo_path: path, status: next });
      await local.clear();
      if (next === 'published') hapticSuccess();
      // Ancienne photo remplacée ou retirée : on la supprime du stockage privé.
      if (previous && previous !== path) await supabase.storage.from('event-media').remove([previous]);
      setPicked(null);
      setPhotoPath(path);
      setSaved(next === 'published' ? 'Ton mot est dans la capsule. Tu peux encore le modifier jusqu’à l’ouverture.' : 'Brouillon enregistré : personne d’autre ne le voit.');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const until = formatEventDate(event.reveal_at, event.timezone, false);
  const statusLine = dirty
    ? { dot: colors.sun, text: 'Modifications non enregistrées' }
    : status === 'published'
      ? { dot: colors.success, text: `Déposé dans la capsule · modifiable jusqu’au ${until}` }
      : entry
        ? { dot: colors.inkFaint, text: 'Brouillon · visible de toi seul' }
        : { dot: colors.inkFaint, text: 'Pas encore commencé' };
  const pick = async () => {
    try {
      const img = await pickImage([1, 1]);
      if (img) setPicked(img);
    } catch {
      setError('Impossible d’ouvrir la galerie.');
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h1">Mon mot</T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={preview ? 'Revenir à l’écriture' : 'Voir l’aperçu de ton mot'}
          onPress={() => setPreview((v) => !v)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: pressed ? colors.lavenderStrong : colors.lavender })}
        >
          {preview ? <PenLine size={17} color={colors.violetDark} /> : <Eye size={17} color={colors.violetDark} />}
          <T v="label" color={colors.violetDark}>
            {preview ? 'Écrire' : 'Aperçu'}
          </T>
        </Pressable>
      </Row>

      {preview ? (
        empty ? (
          <T color={colors.inkSoft}>Rien à prévisualiser : écris quelques mots ou ajoute une photo.</T>
        ) : (
          <MemoryCard
            entry={{ id: 'preview', event_id: event.id, author_id: session?.user.id ?? '', body: body.trim() || null, photo_path: photoPath, status, published_at: null, updated_at: '', profiles: { display_name: 'Moi' } }}
            localUri={picked?.uri}
            light
          />
        )
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          <View style={{ height: 6, backgroundColor: colors.coral }} />
          <View style={{ padding: space.lg, gap: space.sm }}>
            <T v="hand" color={colors.coralInk}>
              Pour {event.beneficiary_name},
            </T>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={1000}
              placeholder="Écris ton mot ici…"
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel={`Ton mot pour ${event.beneficiary_name}`}
              style={[type.body, { minHeight: 132, textAlignVertical: 'top', color: colors.ink, fontSize: 17, lineHeight: 26, paddingVertical: 0 }]}
            />
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              {picked || photoPath ? (
                <View>
                  <PrivateImage path={photoPath} localUri={picked?.uri} style={{ width: 84, height: 84, borderRadius: radius.field }} label="Photo de ton mot" />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retirer la photo"
                    hitSlop={10}
                    onPress={() => {
                      setPicked(null);
                      setPhotoPath(null);
                    }}
                    style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={15} color={colors.white} strokeWidth={2.5} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ajouter une photo à ton mot"
                  onPress={pick}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: pressed ? colors.sand : colors.surfaceSoft })}
                >
                  <ImagePlus size={18} color={colors.ink} />
                  <T v="label">Photo</T>
                </Pressable>
              )}
              <T v="small" color={body.length > 900 ? colors.coralInk : colors.inkFaint}>
                {body.length}/1000
              </T>
            </Row>
          </View>
        </View>
      )}

      <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: statusLine.dot, marginTop: 5 }} />
        <T v="small" color={colors.inkSoft} style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {statusLine.text}
          {restoredUnsaved ? ' · texte retrouvé sur ce téléphone' : ''}
        </T>
      </Row>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {saved && !dirty ? (
        <T v="small" color={colors.success} accessibilityLiveRegion="polite">
          {saved}
        </T>
      ) : null}

      <View style={{ gap: space.sm }}>
        {status === 'published' && !dirty ? null : (
          <Button
            variant="secondary"
            label={status === 'published' ? 'Enregistrer les modifications' : 'Déposer dans la capsule'}
            icon={<Mail size={19} color={colors.white} />}
            disabled={empty}
            loading={busy}
            onPress={() => persist('published')}
            accessibilityHint={`Ton mot restera modifiable jusqu’au ${until}.`}
          />
        )}
        <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }} gap={space.sm}>
          {status === 'draft' ? (
            <Button variant="ghost" compact label="Garder en brouillon" disabled={!dirty || empty} loading={busy} onPress={() => persist('draft')} />
          ) : (
            <Button variant="ghost" compact label="Remettre en brouillon" loading={busy} onPress={() => persist('draft')} />
          )}
          {entry ? <ConfirmButton variant="ghost" label="Supprimer" confirmLabel="Supprimer mon mot" loading={del.isPending} onConfirm={() => del.mutate(entry)} /> : null}
        </Row>
      </View>
    </View>
  );
}

function RevealHeader({ event, beneficiary, count }: { event: EventRow; beneficiary: boolean; count: number }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? FadeIn.duration(150) : ZoomIn.duration(600)} style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
      <Mascot size={120} mood="party" />
      <T v="h1" color={colors.white} style={{ textAlign: 'center' }} accessibilityRole="header">
        {beneficiary ? `Surprise, ${event.beneficiary_name} !` : 'La capsule est ouverte'}
      </T>
      <T color={colors.lavenderStrong} style={{ textAlign: 'center' }}>
        {count > 0 ? `${count} mot${count > 1 ? 's' : ''} de tes proches${beneficiary ? ', rien que pour toi' : ''}.` : 'Les souvenirs de ce jour.'}
      </T>
    </Animated.View>
  );
}

/**
 * Lecture des mots un par un : glisser vers la gauche pour passer au suivant, comme un album.
 * Dernière page : un merci collectif. « Réduire les animations » : défilement sans effet.
 */
function MemoryStory({ visible, onClose, entries, beneficiary, name }: { visible: boolean; onClose: () => void; entries: CapsuleEntryRow[]; beneficiary: boolean; name: string }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const total = entries.length + 1;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.night, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.md }}>
        <Row style={{ paddingHorizontal: gutter, justifyContent: 'space-between' }}>
          <View accessible accessibilityLabel={`Page ${page + 1} sur ${total}`} style={{ flex: 1, marginRight: space.md, flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= page ? colors.sun : 'rgba(255,255,255,0.25)' }} />
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={12} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color={colors.white} />
          </Pressable>
        </Row>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / width))}
          style={{ flex: 1 }}
        >
          {entries.map((x, i) => (
            <ScrollView key={x.id} style={{ width }} contentContainerStyle={{ padding: gutter, paddingTop: space.xxl, justifyContent: 'center', flexGrow: 1 }}>
              <View style={{ transform: [{ rotate: i % 2 ? '1.2deg' : '-1.2deg' }] }}>
                <MemoryCard entry={x} />
              </View>
              <T v="small" color={colors.lavenderStrong} style={{ textAlign: 'center', marginTop: space.lg }}>
                {i < entries.length - 1 ? 'Glisse pour lire le mot suivant' : 'Glisse encore une fois'}
              </T>
            </ScrollView>
          ))}
          <View style={{ width, padding: gutter, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <Mascot size={140} mood="party" />
            <T v="h1" color={colors.white} style={{ textAlign: 'center' }}>
              {beneficiary ? `Tout ça, c’est pour toi, ${name}` : 'Un cadeau à plusieurs mains'}
            </T>
            <T color={colors.lavenderStrong} style={{ textAlign: 'center', maxWidth: 320 }}>
              {beneficiary ? 'Tu peux laisser un mot de remerciement au groupe juste sous le cadeau.' : 'Merci à chaque complice : idées, votes, missions, mots. Ces souvenirs restent ici.'}
            </T>
            <Button label="Revenir à la capsule" variant="white" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MemoryCard({ entry, localUri, light = false }: { entry: CapsuleEntryRow; localUri?: string; light?: boolean }) {
  return (
    <View style={{ backgroundColor: light ? colors.surfaceSoft : colors.white, borderRadius: radius.card, padding: space.lg, gap: space.md, transform: [{ rotate: '-0.6deg' }] }}>
      {entry.photo_path || localUri ? (
        <PrivateImage path={entry.photo_path} localUri={localUri} style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} label={`Photo de ${entry.profiles?.display_name ?? 'un proche'}`} />
      ) : null}
      {entry.body ? <T v="hand">{entry.body}</T> : null}
      <T v="label" color={colors.inkSoft} style={{ fontFamily: fonts.bold, alignSelf: 'flex-end' }}>
        — {entry.profiles?.display_name ?? 'Un proche'}
      </T>
    </View>
  );
}
