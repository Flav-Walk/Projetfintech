import { messageFor, type CapsuleStatus } from '@complice/shared';
import { Eye, ImagePlus, LockKeyhole, Mail, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfirmButton } from '@/components/confirm-button';
import { Mascot } from '@/components/mascot';
import { PrivateImage } from '@/components/private-image';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Row, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useCapsuleEntries, useCapsuleStats, useDeleteEntry, useMyEntry, useSaveEntry } from '@/lib/capsule';
import { formatEventDate, timeUntil } from '@/lib/format';
import { pickImage, uploadImage, type PickedImage } from '@/lib/media';
import { useEvent, useProgress } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { CapsuleEntryRow, EventRow } from '@/lib/types';
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
          refreshControl={<RefreshControl refreshing={entries.isRefetching} tintColor={colors.sun} onRefresh={() => void entries.refetch()} />}
        >
          <RevealHeader event={e} beneficiary={!isPreparer} count={entries.data?.length ?? 0} />
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
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <T v="h1" accessibilityRole="header">
          La capsule
        </T>
        <SealedCard event={e} words={stats.data?.words ?? 0} photos={stats.data?.photos ?? 0} />
        {mine.isPending ? (
          <Loading />
        ) : mine.isError ? (
          <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
        ) : (
          <EntryEditor key={mine.data?.id ?? 'new'} event={e} entry={mine.data} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SealedCard({ event, words, photos }: { event: EventRow; words: number; photos: number }) {
  const now = useNow();
  return (
    <View style={{ backgroundColor: colors.night, borderRadius: radius.card, padding: space.xl, gap: space.md }}>
      <Row>
        <LockKeyhole size={26} color={colors.sun} strokeWidth={1.75} />
        <View style={{ flex: 1 }}>
          <T v="small" color={colors.lavenderStrong}>
            Scellée jusqu’au
          </T>
          <T v="h3" color={colors.white}>
            {formatEventDate(event.reveal_at, event.timezone)} · {timeUntil(event.reveal_at, now)}
          </T>
        </View>
      </Row>
      <Row gap={space.sm}>
        <Chip label={`${words} mot${words > 1 ? 's' : ''}`} tone="sun" />
        <Chip label={`${photos} photo${photos > 1 ? 's' : ''}`} tone="sun" />
      </Row>
      <T v="small" color={colors.lavenderStrong}>
        Le contenu des mots reste secret, même pour l’organisation. Seuls les compteurs sont visibles.
      </T>
    </View>
  );
}

function EntryEditor({ event, entry }: { event: EventRow; entry: CapsuleEntryRow | null }) {
  const { session } = useAuth();
  const save = useSaveEntry(event.id);
  const del = useDeleteEntry(event.id);
  const [body, setBody] = useState(entry?.body ?? '');
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
      setError('Ajoute un mot ou une photo avant de sceller.');
      return;
    }
    setBusy(true);
    let path = photoPath;
    const previous = entry?.photo_path ?? null;
    try {
      if (picked) path = await uploadImage('event-media', `${event.id}/capsule/${session.user.id}`, picked);
      await save.mutateAsync({ id: entry?.id ?? null, body: body.trim() || null, photo_path: path, status: next });
      // Ancienne photo remplacée ou retirée : on la supprime du stockage privé.
      if (previous && previous !== path) await supabase.storage.from('event-media').remove([previous]);
      setPicked(null);
      setPhotoPath(path);
      setSaved(next === 'published' ? 'Ton mot est scellé dans la capsule.' : 'Brouillon enregistré. Personne d’autre ne le voit.');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h3" style={{ flex: 1 }}>
          Mon mot pour {event.beneficiary_name}
        </T>
        <Chip label={status === 'published' ? 'Scellé' : entry ? 'Brouillon' : 'Nouveau'} tone={status === 'published' ? 'lavender' : 'grey'} />
      </Row>

      <Banner tone="info" icon={<Eye size={22} color={colors.violet} />}>
        {`Toi seul vois ce mot avant l’ouverture. Le ${formatEventDate(event.reveal_at, event.timezone)}, ${event.beneficiary_name} et le groupe découvriront les mots scellés. Les brouillons ne sont jamais montrés.`}
      </Banner>

      {preview ? (
        <MemoryCard
          entry={{ id: 'preview', event_id: event.id, author_id: session?.user.id ?? '', body: body.trim() || null, photo_path: photoPath, status, published_at: null, updated_at: '', profiles: { display_name: 'Moi' } }}
          localUri={picked?.uri}
          light
        />
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={1000}
            placeholder={`Joyeux anniversaire ${event.beneficiary_name} !`}
            placeholderTextColor={colors.inkFaint}
            accessibilityLabel="Ton mot pour la capsule"
            style={[type.hand, { minHeight: 140, textAlignVertical: 'top', color: colors.ink, fontSize: 24, lineHeight: 30 }]}
          />
          <T v="small" color={colors.inkSoft} style={{ alignSelf: 'flex-end' }}>
            {body.length}/1000
          </T>
        </View>
      )}

      {picked || photoPath ? (
        <View>
          <PrivateImage path={photoPath} localUri={picked?.uri} style={{ width: '100%', aspectRatio: 1, borderRadius: radius.card }} label="Photo de ton mot" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retirer la photo"
            onPress={() => {
              setPicked(null);
              setPhotoPath(null);
            }}
            style={{ position: 'absolute', top: 8, right: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color={colors.ink} />
          </Pressable>
        </View>
      ) : (
        <Button
          variant="outline"
          compact
          label="Ajouter une photo"
          icon={<ImagePlus size={18} color={colors.ink} />}
          onPress={async () => {
            try {
              const img = await pickImage([1, 1]);
              if (img) setPicked(img);
            } catch {
              setError('Impossible d’ouvrir la galerie.');
            }
          }}
        />
      )}

      {error ? <Banner tone="error">{error}</Banner> : null}
      {saved && !dirty ? <Banner tone="info">{saved}</Banner> : null}

      <Button compact variant="ghost" label={preview ? 'Revenir à l’écriture' : 'Prévisualiser'} icon={<Eye size={16} color={colors.ink} />} onPress={() => setPreview((v) => !v)} />
      <Button
        variant="secondary"
        label={status === 'published' ? (dirty ? 'Mettre à jour mon mot scellé' : 'Mot scellé') : 'Sceller mon mot'}
        icon={<Mail size={20} color={colors.white} />}
        disabled={status === 'published' && !dirty}
        loading={busy}
        onPress={() => persist('published')}
      />
      {status === 'draft' ? (
        <Button variant="outline" label="Enregistrer le brouillon" disabled={!dirty || empty} loading={busy} onPress={() => persist('draft')} />
      ) : (
        <Button variant="ghost" compact label="Repasser en brouillon" loading={busy} onPress={() => persist('draft')} />
      )}
      {entry ? <ConfirmButton label="Supprimer mon mot" confirmLabel="Supprimer définitivement" loading={del.isPending} onConfirm={() => del.mutate(entry)} /> : null}
      <T v="small" color={colors.inkSoft}>
        Modifiable jusqu’à l’ouverture. Ensuite, la capsule est scellée pour de bon.
      </T>
    </View>
  );
}

function RevealHeader({ event, beneficiary, count }: { event: EventRow; beneficiary: boolean; count: number }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? FadeIn.duration(150) : ZoomIn.duration(600)} style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
      <Mascot size={120} mood="wink" />
      <T v="h1" color={colors.white} style={{ textAlign: 'center' }} accessibilityRole="header">
        {beneficiary ? `Surprise, ${event.beneficiary_name} !` : 'La capsule est ouverte'}
      </T>
      <T color={colors.lavenderStrong} style={{ textAlign: 'center' }}>
        {count > 0 ? `${count} mot${count > 1 ? 's' : ''} de tes proches${beneficiary ? ', rien que pour toi' : ''}.` : 'Les souvenirs de ce jour.'}
      </T>
    </Animated.View>
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
