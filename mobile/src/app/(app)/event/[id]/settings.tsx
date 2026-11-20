import { formatCents, messageFor, parseAmountToCents, TARGET_MAX_CENTS, TARGET_MIN_CENTS } from '@complice/shared';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { DateField } from '@/components/date-field';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { formatEventDate } from '@/lib/format';
import { useEvent, useProgress, useUpdateEvent, type EventSettingsPatch } from '@/lib/queries';
import type { EventRow } from '@/lib/types';
import { useEventId } from '@/lib/use-event-context';
import { useNow } from '@/lib/use-now';
import { colors, space } from '@/theme/tokens';

export default function EventSettings() {
  const id = useEventId();
  const event = useEvent(id);
  const progress = useProgress(id);

  if (event.isPending || progress.isPending) return <Loading />;
  if (event.isError || !event.data) return <Screen><ErrorState error={event.error ?? 'forbidden'} onRetry={() => event.refetch()} /></Screen>;
  const isManager = progress.data?.my_role === 'organizer' || progress.data?.my_role === 'co_organizer';
  if (!isManager) {
    return (
      <Screen>
        <BackHeader title="Réglages" fallback={`/event/${id}`} />
        <Banner tone="error">Seuls l’organisateur et les coorganisateurs modifient les réglages.</Banner>
      </Screen>
    );
  }
  // La clé réinitialise le formulaire si l'événement est modifié ailleurs (temps réel).
  return <SettingsForm key={event.data.id + event.data.status} e={event.data} />;
}

function SettingsForm({ e }: { e: EventRow }) {
  const update = useUpdateEvent(e.id);
  const now = useNow();
  const [title, setTitle] = useState(e.title);
  const [beneficiary, setBeneficiary] = useState(e.beneficiary_name);
  const [description, setDescription] = useState(e.description ?? '');
  const [target, setTarget] = useState(String(e.target_cents / 100).replace('.', ','));
  const [publicVotes, setPublicVotes] = useState(e.vote_visibility === 'public');
  const [dates, setDates] = useState(() => ({
    gift: new Date(e.gift_at),
    votes: new Date(e.votes_close_at),
    contrib: new Date(e.contributions_close_at),
    reveal: new Date(e.reveal_at),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const locked = {
    votes: new Date(e.votes_close_at).getTime() <= now,
    contrib: new Date(e.contributions_close_at).getTime() <= now,
    reveal: new Date(e.reveal_at).getTime() <= now,
  };
  const frozen = e.status !== 'active';

  async function save() {
    setError(null);
    setSaved(false);
    const cents = parseAmountToCents(target);
    if (cents === null || cents < TARGET_MIN_CENTS || cents > TARGET_MAX_CENTS) return setError(`Objectif entre ${formatCents(TARGET_MIN_CENTS)} et ${formatCents(TARGET_MAX_CENTS)}.`);
    if (title.trim().length < 2) return setError('Le titre est trop court.');
    if (!beneficiary.trim()) return setError('Indique la personne fêtée.');
    if (dates.votes > dates.reveal || dates.contrib > dates.reveal) return setError('Le vote et les participations doivent se terminer avant l’ouverture de la capsule.');
    const patch: EventSettingsPatch = {
      title: title.trim(),
      beneficiary_name: beneficiary.trim(),
      description: description.trim() || null,
      target_cents: cents,
      vote_visibility: publicVotes ? 'public' : 'private',
      gift_at: dates.gift.toISOString(),
    };
    // Seules les échéances encore modifiables sont envoyées (la base refuse les autres).
    if (!locked.votes) patch.votes_close_at = dates.votes.toISOString();
    if (!locked.contrib) patch.contributions_close_at = dates.contrib.toISOString();
    if (!locked.reveal) patch.reveal_at = dates.reveal.toISOString();
    try {
      await update.mutateAsync(patch);
      setSaved(true);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <Screen footer={!frozen ? <Button label="Enregistrer" onPress={save} loading={update.isPending} /> : undefined}>
      <BackHeader title="Réglages" subtitle={e.title} fallback={`/event/${e.id}`} />
      {frozen ? <Banner tone="info">Événement terminé : les réglages sont figés.</Banner> : null}
      {saved ? <Banner tone="info">Réglages enregistrés.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Field label="Titre" value={title} onChangeText={setTitle} maxLength={80} editable={!frozen} />
      <Field label="Personne fêtée" value={beneficiary} onChangeText={setBeneficiary} maxLength={60} editable={!frozen} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={600} editable={!frozen} />
      <Field label="Objectif" value={target} onChangeText={setTarget} keyboardType="decimal-pad" suffix="€" editable={!frozen} />
      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="bodyBold" style={{ flex: 1 }}>
            Votes visibles par le groupe
          </T>
          <Switch value={publicVotes} onValueChange={setPublicVotes} disabled={frozen} trackColor={{ true: colors.violet, false: colors.border }} accessibilityLabel="Rendre visibles les votes de chacun" />
        </Row>
        <T v="small" color={colors.inkSoft}>
          {publicVotes ? 'Chacun voit qui a voté pour quoi. Préviens le groupe de ce changement.' : 'Le groupe voit seulement le nombre de voix par idée.'}
        </T>
      </Card>

      <T v="h2">Dates</T>
      <DateField label="Remise du cadeau" value={dates.gift} onChange={(d) => setDates({ ...dates, gift: d })} />
      <LockableDate label="Fin du vote" locked={locked.votes} iso={e.votes_close_at} tz={e.timezone} value={dates.votes} onChange={(d) => setDates({ ...dates, votes: d })} />
      <LockableDate label="Fin des participations" locked={locked.contrib} iso={e.contributions_close_at} tz={e.timezone} value={dates.contrib} onChange={(d) => setDates({ ...dates, contrib: d })} />
      <LockableDate label="Ouverture de la capsule" locked={locked.reveal} iso={e.reveal_at} tz={e.timezone} value={dates.reveal} onChange={(d) => setDates({ ...dates, reveal: d })} />
      <Button label="Membres et invitations" variant="outline" onPress={() => router.push(`/event/${e.id}/members` as never)} />
    </Screen>
  );
}

function LockableDate({ label, locked, iso, tz, value, onChange }: { label: string; locked: boolean; iso: string; tz: string; value: Date; onChange: (d: Date) => void }) {
  if (!locked) return <DateField label={label} value={value} onChange={onChange} />;
  return (
    <View style={{ gap: 6 }}>
      <T v="label">{label}</T>
      <Row gap={space.sm}>
        <Lock size={18} color={colors.inkSoft} strokeWidth={1.75} />
        <T color={colors.inkSoft}>{formatEventDate(iso, tz)} · échéance passée, non modifiable</T>
      </Row>
    </View>
  );
}
