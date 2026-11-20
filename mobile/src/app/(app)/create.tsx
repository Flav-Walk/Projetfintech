import { formatCents, messageFor, parseAmountToCents, TARGET_MAX_CENTS, TARGET_MIN_CENTS } from '@complice/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Eye, EyeOff, ImagePlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { BackButton } from '@/components/back-header';
import { DateField } from '@/components/date-field';
import { Banner, Button, Card, Field, ProgressBar, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { deviceTimezone } from '@/lib/format';
import { pickImage, uploadImage, type PickedImage } from '@/lib/media';
import { useCreateEvent } from '@/lib/queries';
import { colors, radius, space } from '@/theme/tokens';

const OCCASIONS = ['anniversaire', 'départ', 'naissance', 'mariage', 'pot de thèse', 'remerciement', 'autre'];

function defaultGiftDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(19, 0, 0, 0);
  return d;
}
function shift(d: Date, days: number) {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

export default function CreateEvent() {
  const { session } = useAuth();
  const create = useCreateEvent();
  const [step, setStep] = useState(0);
  const [beneficiary, setBeneficiary] = useState('');
  const [occasion, setOccasion] = useState('anniversaire');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [publicVotes, setPublicVotes] = useState(false);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [initialGift] = useState(defaultGiftDate);
  const [giftAt, setGiftAt] = useState(initialGift);
  const [votesAt, setVotesAt] = useState(shift(initialGift, -5));
  const [contribAt, setContribAt] = useState(shift(initialGift, -2));
  const [revealAt, setRevealAt] = useState(initialGift);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const suggestedTitle = beneficiary.trim() ? `${occasion === 'anniversaire' ? 'L’anniversaire' : `Cadeau ${occasion}`} de ${beneficiary.trim()}` : '';
  const finalTitle = (title.trim() || suggestedTitle).slice(0, 80);
  const targetCents = parseAmountToCents(target);

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!beneficiary.trim()) e.beneficiary = 'Pour qui prépare-t-on ce cadeau ?';
      if (finalTitle.length < 2) e.title = 'Donne un titre à l’événement.';
    }
    if (s === 1) {
      if (targetCents === null) e.target = 'Saisis un montant, par exemple 180.';
      else if (targetCents < TARGET_MIN_CENTS || targetCents > TARGET_MAX_CENTS) e.target = `Entre ${formatCents(TARGET_MIN_CENTS)} et ${formatCents(TARGET_MAX_CENTS)}.`;
    }
    if (s === 2) {
      const now = Date.now();
      if (revealAt.getTime() <= now) e.reveal = 'L’ouverture doit être dans le futur.';
      if (votesAt.getTime() <= now) e.votes = 'La fin du vote doit être dans le futur.';
      if (votesAt > revealAt) e.votes = 'Le vote doit se terminer avant l’ouverture de la capsule.';
      if (contribAt.getTime() <= now) e.contrib = 'La fin des participations doit être dans le futur.';
      if (contribAt > revealAt) e.contrib = 'Les participations doivent se terminer avant l’ouverture.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate(2) || !session) return;
    setFormError(null);
    try {
      let coverPath: string | null = null;
      if (cover) {
        setUploading(true);
        coverPath = await uploadImage('event-media', `${session.user.id}/covers`, cover);
        setUploading(false);
      }
      const id = await create.mutateAsync({
        title: finalTitle,
        beneficiaryName: beneficiary.trim(),
        occasion,
        description: description.trim(),
        targetCents: targetCents!,
        giftAt,
        votesCloseAt: votesAt,
        contributionsCloseAt: contribAt,
        revealAt,
        timezone: deviceTimezone(),
        voteVisibility: publicVotes ? 'public' : 'private',
        coverPath,
      });
      router.replace({ pathname: '/event/[id]', params: { id, created: '1' } });
    } catch (e) {
      setUploading(false);
      setFormError(e instanceof Error && /Format|lourde/.test(e.message) ? e.message : messageFor(e));
    }
  }

  const steps = ['Pour qui ?', 'La cagnotte', 'Les dates'];

  return (
    <Screen
      footer={
        <Row>
          {step > 0 ? <Button label="Retour" variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
          {step < 2 ? (
            <Button label="Continuer" onPress={() => validate(step) && setStep(step + 1)} style={{ flex: 2 }} />
          ) : (
            <Button label="Créer la cagnotte" onPress={submit} loading={create.isPending || uploading} style={{ flex: 2 }} />
          )}
        </Row>
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <BackButton fallback="/events" />
        <T v="label" color={colors.inkSoft}>
          Étape {step + 1} sur 3
        </T>
      </Row>
      <T v="h1" accessibilityRole="header">
        {steps[step]}
      </T>
      <ProgressBar value={((step + 1) / 3) * 100} fill={colors.violet} track={colors.lavender} height={6} label={`Étape ${step + 1} sur 3`} />

      {step === 0 ? (
        <>
          <Field label="Prénom de la personne fêtée" value={beneficiary} onChangeText={setBeneficiary} placeholder="Camille" maxLength={60} error={errors.beneficiary} autoCapitalize="words" />
          <View style={{ gap: 6 }}>
            <T v="label">Occasion</T>
            <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
              {OCCASIONS.map((o) => (
                <Pressable
                  key={o}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: occasion === o }}
                  onPress={() => setOccasion(o)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: occasion === o ? colors.violet : colors.border, backgroundColor: occasion === o ? colors.lavender : colors.surface }}
                >
                  <T v="label" color={occasion === o ? colors.violetDark : colors.ink}>
                    {o}
                  </T>
                </Pressable>
              ))}
            </Row>
          </View>
          <Field label="Titre" value={title} onChangeText={setTitle} placeholder={suggestedTitle || 'Les 25 ans de Camille'} maxLength={80} error={errors.title} hint={!title && suggestedTitle ? `Si vide : « ${suggestedTitle} »` : undefined} />
          <Field label="Description (facultatif)" value={description} onChangeText={setDescription} multiline maxLength={600} placeholder="Une idée de l’ambiance, ce qu’elle aime…" />
          <View style={{ gap: 6 }}>
            <T v="label">Image (facultatif)</T>
            {cover ? (
              <View>
                <Image source={{ uri: cover.uri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.card }} contentFit="cover" accessibilityLabel="Image de couverture choisie" />
                <Pressable accessibilityRole="button" accessibilityLabel="Retirer l’image" onPress={() => setCover(null)} style={{ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} color={colors.ink} />
                </Pressable>
              </View>
            ) : (
              <Button label="Choisir une image" variant="outline" icon={<ImagePlus size={20} color={colors.ink} strokeWidth={1.75} />} onPress={async () => setCover(await pickImage())} />
            )}
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Field label="Objectif de la cagnotte" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="180" suffix="€" error={errors.target} hint="Indicatif : chacun reste libre de son montant." />
          <Card style={{ gap: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={space.sm} style={{ flex: 1 }}>
                {publicVotes ? <Eye size={22} color={colors.violet} strokeWidth={1.75} /> : <EyeOff size={22} color={colors.inkSoft} strokeWidth={1.75} />}
                <T v="bodyBold" style={{ flex: 1 }}>
                  Votes visibles par le groupe
                </T>
              </Row>
              <Switch value={publicVotes} onValueChange={setPublicVotes} trackColor={{ true: colors.violet, false: colors.border }} accessibilityLabel="Rendre visibles les votes de chacun" />
            </Row>
            <T v="small" color={colors.inkSoft}>
              {publicVotes
                ? 'Chacun verra qui a voté pour quelle idée. Annonce-le au groupe avant le vote.'
                : 'Par défaut, le groupe voit le nombre de voix par idée, jamais qui a voté quoi.'}
            </T>
          </Card>
          <Banner tone="info" title="Confidentialité des montants">
            Le groupe voit le total et le nombre de participations. Chaque montant individuel n’est visible que par la personne qui l’a donné.
          </Banner>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <DateField label="Remise du cadeau" value={giftAt} onChange={setGiftAt} minimumDate={new Date()} />
          <DateField label="Fin du vote" value={votesAt} onChange={setVotesAt} minimumDate={new Date()} error={errors.votes} hint="Après cette date, plus de vote ni de nouvelle idée." />
          <DateField label="Fin des participations" value={contribAt} onChange={setContribAt} minimumDate={new Date()} error={errors.contrib} />
          <DateField label="Ouverture de la capsule" value={revealAt} onChange={setRevealAt} minimumDate={new Date()} error={errors.reveal} hint="La personne fêtée découvre les mots, les photos et le cadeau à cette date." />
          <Row gap={space.sm}>
            <Button label="Tout caler sur la remise" variant="ghost" compact onPress={() => { setRevealAt(giftAt); setVotesAt(shift(giftAt, -5)); setContribAt(shift(giftAt, -2)); }} />
          </Row>
          <T v="small" color={colors.inkSoft}>Fuseau horaire : {deviceTimezone()}</T>
        </>
      ) : null}

      {formError ? <Banner tone="error">{formError}</Banner> : null}
    </Screen>
  );
}
