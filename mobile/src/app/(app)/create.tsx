import { formatCents, messageFor, parseAmountToCents, TARGET_MAX_CENTS, TARGET_MIN_CENTS } from '@complice/shared';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { BackButton } from '@/components/back-header';
import { CoverPicker, type CoverChoice } from '@/components/cover-picker';
import { DateField } from '@/components/date-field';
import { Banner, Button, Card, Field, ProgressBar, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { artForOccasion } from '@/lib/covers';
import { deviceTimezone } from '@/lib/format';
import { uploadImage } from '@/lib/media';
import { useCreateEvent } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

const OCCASIONS = ['anniversaire', 'soirée', 'départ', 'naissance', 'mariage', 'entre amis', 'autre'];

/**
 * Modèles : des valeurs de départ raisonnables, toutes modifiables. Ils ne recopient jamais le contenu
 * d'un ancien événement (membres, messages, photos, participations).
 */
const TEMPLATES: { key: string; label: string; occasion: string; days: number; target: string; hint: string }[] = [
  { key: 'birthday', label: 'Anniversaire', occasion: 'anniversaire', days: 14, target: '150', hint: 'Cadeau dans 2 semaines, vote 5 jours avant.' },
  { key: 'leaving', label: 'Départ d’un·e collègue', occasion: 'départ', days: 10, target: '120', hint: 'Carte signée par l’équipe et pot de départ inclus dans les missions.' },
  { key: 'birth', label: 'Naissance', occasion: 'naissance', days: 21, target: '150', hint: 'Trois semaines pour s’organiser avec les parents.' },
];

function defaultGiftDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
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
  // Couverture : illustration selon l'occasion tant que rien n'est choisi, photo ou illustration ensuite.
  const [coverChoice, setCoverChoice] = useState<CoverChoice | null>(null);
  const cover: CoverChoice = coverChoice ?? { kind: 'art', art: artForOccasion(occasion) };
  const [initialGift] = useState(defaultGiftDate);
  const [giftAt, setGiftAt] = useState(initialGift);
  const [votesAt, setVotesAt] = useState(shift(initialGift, -5));
  const [contribAt, setContribAt] = useState(shift(initialGift, -2));
  const [revealAt, setRevealAt] = useState(initialGift);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTemplate(t.key);
    setOccasion(t.occasion);
    if (!target) setTarget(t.target);
    const gift = defaultGiftDate(t.days);
    setGiftAt(gift);
    setRevealAt(gift);
    setVotesAt(shift(gift, -5));
    setContribAt(shift(gift, -2));
  }

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
      if (giftAt.getTime() <= now) e.gift = 'La remise du cadeau doit être dans le futur.';
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
      if (cover.kind === 'photo') {
        setUploading(true);
        coverPath = await uploadImage('event-media', `${session.user.id}/covers`, cover.picked);
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
      // Illustration choisie : enregistrée juste après la création (organisateur = gestionnaire).
      if (cover.kind === 'art') await supabase.from('events').update({ cover_art: cover.art }).eq('id', id);
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
      <ProgressBar value={((step + 1) / 3) * 100} fill={colors.ink} track={colors.sand} height={6} label={`Étape ${step + 1} sur 3`} />

      {step === 0 ? (
        <>
          <View style={{ gap: 6 }}>
            <T v="label">Partir d’un modèle (facultatif)</T>
            <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
              {TEMPLATES.map((t) => (
                <Pressable
                  key={t.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: template === t.key }}
                  accessibilityHint={t.hint}
                  onPress={() => applyTemplate(t)}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: template === t.key ? colors.coral : colors.border, backgroundColor: template === t.key ? colors.coralSoft : colors.surface }}
                >
                  <T v="label" color={template === t.key ? colors.coralDark : colors.ink}>
                    {t.label}
                  </T>
                </Pressable>
              ))}
            </Row>
            {template ? <T v="small" color={colors.inkSoft}>{TEMPLATES.find((t) => t.key === template)!.hint} Tout reste modifiable.</T> : null}
          </View>
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
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5, borderColor: occasion === o ? colors.ink : colors.border, backgroundColor: occasion === o ? colors.ink : colors.surface }}
                >
                  <T v="label" color={occasion === o ? colors.white : colors.ink}>
                    {o.charAt(0).toUpperCase() + o.slice(1)}
                  </T>
                </Pressable>
              ))}
            </Row>
          </View>
          <Field label="Titre" value={title} onChangeText={setTitle} placeholder={suggestedTitle || 'Les 25 ans de Camille'} maxLength={80} error={errors.title} hint={!title && suggestedTitle ? `Si vide : « ${suggestedTitle} »` : undefined} />
          <Field label="Description (facultatif)" value={description} onChangeText={setDescription} multiline maxLength={600} placeholder="Une idée de l’ambiance, ce qu’elle aime…" />
          <View style={{ gap: 6 }}>
            <T v="label">Couverture</T>
            <CoverPicker value={cover} onChange={setCoverChoice} occasion={occasion} onError={setFormError} />
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Field label="Objectif de la cagnotte" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="180" suffix="€" error={errors.target} hint="Indicatif : chacun reste libre de son montant." />
          <Card style={{ gap: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={space.sm} style={{ flex: 1 }}>
                {publicVotes ? <Eye size={22} color={colors.ink} strokeWidth={1.75} /> : <EyeOff size={22} color={colors.inkSoft} strokeWidth={1.75} />}
                <T v="bodyBold" style={{ flex: 1 }}>
                  Votes visibles par le groupe
                </T>
              </Row>
              <Switch value={publicVotes} onValueChange={setPublicVotes} trackColor={{ true: colors.ink, false: colors.border }} accessibilityLabel="Rendre visibles les votes de chacun" />
            </Row>
            <T v="small" color={colors.inkSoft}>
              {publicVotes
                ? 'Chacun verra qui a voté pour quelle idée. Annonce-le au groupe avant le vote.'
                : 'Par défaut, le groupe voit le nombre de voix par idée, jamais qui a voté quoi.'}
            </T>
          </Card>
          <Banner tone="info" title="Confidentialité des montants">
            Chacun voit seulement son propre montant. Le groupe suit la cagnotte par paliers (un quart, la moitié…). Le total exact n’apparaît qu’aux organisateurs, une fois les participations closes, pour acheter le cadeau. La personne fêtée ne voit aucun montant.
          </Banner>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <DateField label="Remise du cadeau" value={giftAt} onChange={setGiftAt} minimumDate={new Date()} error={errors.gift} />
          <DateField label="Fin du vote" value={votesAt} onChange={setVotesAt} minimumDate={new Date()} error={errors.votes} hint="Après cette date, plus de vote ni de nouvelle idée." />
          <DateField label="Fin des participations" value={contribAt} onChange={setContribAt} minimumDate={new Date()} error={errors.contrib} />
          <DateField label="Ouverture de la capsule" value={revealAt} onChange={setRevealAt} minimumDate={new Date()} error={errors.reveal} hint="La personne fêtée découvre les mots et les photos à cette date. Elle ne verra ni le cadeau choisi ni la cagnotte dans l’app." />
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
