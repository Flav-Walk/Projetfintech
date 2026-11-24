import {
  CONTRIBUTION_MAX_CENTS,
  CONTRIBUTION_MIN_CENTS,
  formatCents,
  messageFor,
  SIMULATED_FEE_CENTS,
  SUGGESTED_AMOUNTS_CENTS,
  validateContribution,
  type ContributionResponse,
} from '@complice/shared';
import { router } from 'expo-router';
import { CircleAlert, PartyPopper, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { FundingCard } from '@/components/event-parts';
import { Toggle } from '@/components/kit';
import { Mascot } from '@/components/mascot';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Chip, Field, Row, Screen, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { loadAttempt, newAttempt, saveAttempt, useContribute, useMyContributions, type Attempt } from '@/lib/contributions';
import { formatEventDate } from '@/lib/format';
import { useEvent, useFunding, useProgress } from '@/lib/queries';
import { useEventId } from '@/lib/use-event-context';
import { colors, fonts, radius, space } from '@/theme/tokens';

type Step = 'amount' | 'recap' | 'result';

const STATUS_LABEL: Record<ContributionResponse['status'], { label: string; tone: 'mint' | 'coral' | 'grey' | 'sun' }> = {
  confirmed: { label: 'Confirmée', tone: 'mint' },
  failed: { label: 'Refusée', tone: 'coral' },
  pending: { label: 'En attente', tone: 'sun' },
  cancelled: { label: 'Annulée', tone: 'grey' },
};

export default function Contribute() {
  const id = useEventId();
  const event = useEvent(id);
  const progress = useProgress(id);
  const funding = useFunding(id);
  const history = useMyContributions(id);
  const contribute = useContribute(id);

  const [step, setStep] = useState<Step>('amount');
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [resumable, setResumable] = useState<Attempt | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [result, setResult] = useState<ContributionResponse | null>(null);

  // Une tentative interrompue (app fermée, réseau coupé) peut être vérifiée sans risque de doublon.
  useEffect(() => {
    let alive = true;
    loadAttempt(id).then((a) => alive && setResumable(a));
    return () => {
      alive = false;
    };
  }, [id]);

  if (event.isPending || progress.isPending) return <Loading />;
  if (!event.data || !progress.data) {
    return (
      <Screen>
        <BackHeader title="Participer" />
        <ErrorState error={event.error ?? progress.error} onRetry={() => event.refetch()} />
      </Screen>
    );
  }
  const e = event.data;
  const open = progress.data.contributions_open;
  const validation = validateContribution(input);
  const amountError = !touched || validation.ok
    ? null
    : validation.reason === 'too_small'
      ? `Minimum ${formatCents(CONTRIBUTION_MIN_CENTS)}.`
      : validation.reason === 'too_large'
        ? `Maximum ${formatCents(CONTRIBUTION_MAX_CENTS)} par participation.`
        : 'Montant invalide, par exemple 25 ou 25,50.';
  const cents = validation.ok ? validation.cents : null;

  const send = (a: Attempt) => {
    setAttempt(a);
    contribute.mutate(
      { attempt: a, simulate: simulateFailure ? 'failure' : undefined },
      {
        onSuccess: (res) => {
          setResult(res);
          setResumable(null);
          setStep('result');
        },
      },
    );
  };

  const networkError = contribute.error instanceof ApiError && (contribute.error.code === 'network' || contribute.error.status >= 500);

  return (
    <Screen
      footer={
        step === 'amount' ? (
          <Button
            label={cents ? `Continuer · ${formatCents(cents)}` : 'Continuer'}
            disabled={!open}
            onPress={() => {
              setTouched(true);
              if (validation.ok) setStep('recap');
            }}
          />
        ) : step === 'recap' ? (
          <Button
            label={networkError ? 'Réessayer' : `Confirmer ${formatCents((cents ?? 0) + SIMULATED_FEE_CENTS)}`}
            loading={contribute.isPending}
            onPress={() => send(networkError && attempt ? attempt : attempt ?? newAttempt(cents!))}
            accessibilityHint="Mode démo : participation enregistrée sans paiement réel"
          />
        ) : result?.status === 'confirmed' ? (
          <Button label="Retour à l’événement" onPress={() => router.back()} />
        ) : (
          <Button
            label="Réessayer"
            onPress={() => {
              // Échec connu : nouvelle tentative = nouvelle clé (la précédente est close).
              setAttempt(null);
              setResult(null);
              contribute.reset();
              setStep('recap');
            }}
          />
        )
      }
    >
      <BackHeader
        title={step === 'result' ? 'Participation' : step === 'recap' ? 'Récapitulatif' : 'Participer'}
        subtitle={step === 'amount' ? `Pour ${e.beneficiary_name} · ${e.title}` : undefined}
      />

      {resumable && step === 'amount' ? (
        <Card tone="soft" style={{ gap: space.sm }}>
          <T v="bodyBold">Une participation de {formatCents(resumable.amount_cents)} n’a pas reçu de réponse.</T>
          <T v="small" color={colors.inkSoft}>
            La vérifier ne crée pas de doublon : si elle a déjà été enregistrée, tu verras son résultat.
          </T>
          <Row>
            <Button
              compact
              label="Vérifier"
              loading={contribute.isPending}
              onPress={() => {
                setInput(String(resumable.amount_cents / 100).replace('.', ','));
                setStep('recap');
                send(resumable);
              }}
            />
            <Button
              compact
              variant="ghost"
              label="Ignorer"
              onPress={() => {
                void saveAttempt(id, null);
                setResumable(null);
              }}
            />
          </Row>
        </Card>
      ) : null}

      {step === 'amount' ? (
        <>
          {funding.data ? <FundingCard funding={funding.data} /> : null}
          {!open ? (
            <Banner tone="info" title="Participations closes">
              {`Les participations étaient ouvertes jusqu’au ${formatEventDate(e.contributions_close_at, e.timezone)}.`}
            </Banner>
          ) : (
            <>
              <T v="h3">Choisis un montant</T>
              <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
                {SUGGESTED_AMOUNTS_CENTS.map((c) => {
                  const selected = cents === c;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={formatCents(c)}
                      onPress={() => {
                        setInput(String(c / 100));
                        setTouched(true);
                      }}
                      style={{
                        minWidth: 72,
                        minHeight: 52,
                        paddingHorizontal: space.lg,
                        borderRadius: radius.button,
                        borderWidth: 2,
                        borderColor: selected ? colors.coral : colors.border,
                        backgroundColor: selected ? colors.coralSoft : colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <T v="bodyBold" color={selected ? colors.coralDark : colors.ink} style={{ fontFamily: fonts.black, fontSize: 18 }}>
                        {formatCents(c)}
                      </T>
                    </Pressable>
                  );
                })}
              </Row>
              <Field
                label="Ou un autre montant"
                value={input}
                onChangeText={(v) => {
                  setInput(v);
                  setAttempt(null);
                }}
                onBlur={() => setTouched(true)}
                keyboardType="decimal-pad"
                placeholder="25"
                suffix="€"
                error={amountError}
                hint={`Entre ${formatCents(CONTRIBUTION_MIN_CENTS)} et ${formatCents(CONTRIBUTION_MAX_CENTS)}. Ton montant reste privé : le groupe voit seulement le total de la cagnotte.`}
              />
            </>
          )}
        </>
      ) : null}

      {step === 'recap' && cents ? (
        <>
          <Card style={{ gap: space.md }}>
            <RecapLine label="Ta participation" value={formatCents(cents, { forceDecimals: true })} />
            <RecapLine label="Frais" value={SIMULATED_FEE_CENTS === 0 ? 'Aucun' : formatCents(SIMULATED_FEE_CENTS, { forceDecimals: true })} />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <RecapLine label="Total" value={formatCents(cents + SIMULATED_FEE_CENTS, { forceDecimals: true })} strong />
          </Card>
          <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <ShieldCheck size={18} color={colors.violet} style={{ marginTop: 2 }} />
            <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>
              Ton montant reste privé : le groupe voit seulement le total.
            </T>
          </Row>
          <DemoNotice />
          {__DEV__ ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>
                Outil de développement : simuler un refus
              </T>
              <Toggle value={simulateFailure} onValueChange={setSimulateFailure} label="Simuler un refus (développement)" />
            </Row>
          ) : null}
          {contribute.isError ? (
            <Banner tone="error" title={networkError ? 'Pas de réponse du serveur' : 'Participation impossible'}>
              {networkError
                ? 'Ta participation a peut-être été reçue. Réessaie : elle ne sera pas comptée deux fois.'
                : messageFor(contribute.error)}
            </Banner>
          ) : null}
          {!contribute.isPending ? <Button compact variant="ghost" label="Modifier le montant" onPress={() => (setStep('amount'), setAttempt(null), contribute.reset())} /> : null}
        </>
      ) : null}

      {step === 'result' && result ? (
        result.status === 'confirmed' ? (
          <Card tone="lavender" style={{ alignItems: 'center', gap: space.md }}>
            <Mascot size={96} mood="wink" />
            <Row gap={space.sm}>
              <PartyPopper size={24} color={colors.violet} />
              <T v="h2">Participation enregistrée</T>
            </Row>
            <T style={{ textAlign: 'center' }}>Merci ! Ta participation de {formatCents(result.amount_cents)} compte maintenant dans la cagnotte du groupe.</T>
            {funding.data ? (
              <T v="small" color={colors.inkSoft} style={{ textAlign: 'center' }}>
                La cagnotte du groupe atteint {formatCents(funding.data.collected_cents)} sur {formatCents(funding.data.target_cents)}.
              </T>
            ) : null}
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <CircleAlert size={40} color={colors.danger} />
            <T v="h2">Participation non enregistrée</T>
            <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
              Elle n’a pas été comptée. Tu peux réessayer avec le même montant ou en changer.
            </T>
          </Card>
        )
      ) : null}

      <View style={{ gap: space.md }}>
        <T v="h3">Mon historique</T>
        {history.isPending ? (
          <T color={colors.inkSoft}>Chargement…</T>
        ) : history.isError ? (
          <ErrorState error={history.error} onRetry={() => history.refetch()} />
        ) : history.data.length === 0 ? (
          <T color={colors.inkSoft}>Aucune participation pour l’instant.</T>
        ) : (
          history.data.map((c) => (
            <Card key={c.id} style={{ padding: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <T v="bodyBold">{formatCents(c.amount_cents)}</T>
                  <T v="small" color={colors.inkSoft}>
                    {formatEventDate(c.created_at, e.timezone)}
                  </T>
                </View>
                <Chip label={STATUS_LABEL[c.status].label} tone={STATUS_LABEL[c.status].tone} />
              </Row>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

/**
 * « Mode démo » discret : l'app ne passe par aucun prestataire de paiement, ne demande ni carte ni
 * coordonnées bancaires, et n'affirme jamais qu'un débit ou un virement a eu lieu.
 */
function DemoNotice() {
  const [open, setOpen] = useState(false);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Mode démo. Plus d’informations" onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ gap: 4 }}>
      <Row gap={6}>
        <View style={{ backgroundColor: colors.sunSoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <T v="small" color={colors.sunInk} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
            Mode démo
          </T>
        </View>
        <T v="small" color={colors.inkSoft} style={{ textDecorationLine: open ? 'none' : 'underline' }}>
          {open ? 'Aucune carte bancaire n’est demandée.' : 'En savoir plus'}
        </T>
      </Row>
      {open ? (
        <T v="small" color={colors.inkSoft}>
          Cette version de COMPLICE enregistre les participations sans paiement réel : aucun argent n’est prélevé ni versé.
        </T>
      ) : null}
    </Pressable>
  );
}

function RecapLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <T v={strong ? 'bodyBold' : 'body'} color={strong ? colors.ink : colors.inkSoft}>
        {label}
      </T>
      <T v={strong ? 'h3' : 'bodyBold'}>{value}</T>
    </Row>
  );
}
