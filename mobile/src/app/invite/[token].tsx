import { INVITATION_MESSAGES, ROLE_LABELS, messageFor } from '@complice/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Users } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BackButton } from '@/components/back-header';
import { Logo, Mascot } from '@/components/mascot';
import { ErrorState, Loading } from '@/components/states';
import { Banner, Button, Card, Row, Screen, T } from '@/components/ui';
import { signOutEverywhere, useAuth } from '@/lib/auth';
import { formatEventDate } from '@/lib/format';
import { clearPendingInvite, extractInviteToken, savePendingInvite } from '@/lib/pending-invite';
import { useAcceptInvitation, useInvitationPreview } from '@/lib/queries';
import { colors, space } from '@/theme/tokens';

/**
 * Lien profond complice://invite/<jeton>. Affiche l'événement avant toute action,
 * mémorise le jeton pendant l'inscription, puis rejoint et ouvre l'événement.
 */
export default function InviteScreen() {
  const params = useLocalSearchParams<{ token: string; auto?: string }>();
  const token = extractInviteToken(params.token ?? '');
  const { session } = useAuth();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const autoTried = useRef(false);

  async function join() {
    if (!token) return;
    setAcceptError(null);
    try {
      const r = await accept.mutateAsync(token);
      if ((r.status === 'joined' || r.status === 'already_member') && r.event_id) {
        await clearPendingInvite(token);
        router.replace({ pathname: '/event/[id]', params: { id: r.event_id, welcome: r.status === 'joined' ? '1' : undefined } });
      } else {
        setAcceptError(INVITATION_MESSAGES[r.status]);
        preview.refetch();
      }
    } catch (e) {
      setAcceptError(messageFor(e));
    }
  }

  async function goAuth(path: '/sign-up' | '/sign-in') {
    if (token) await savePendingInvite(token);
    router.push(path);
  }

  // Retour après inscription / connexion : on rejoint automatiquement une invitation valide.
  useEffect(() => {
    if (params.auto === '1' && session && preview.data?.status === 'valid' && !autoTried.current) {
      autoTried.current = true;
      join();
    }
    if (preview.data?.status === 'already_member' && preview.data.event_id && params.auto === '1') {
      const id = preview.data.event_id;
      void clearPendingInvite(token!).then(() => router.replace({ pathname: '/event/[id]', params: { id } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.auto, session, preview.data]);

  if (!token) {
    return (
      <Screen>
        <Logo size="sm" />
        <Banner tone="error" title="Lien incomplet">{INVITATION_MESSAGES.invalid}</Banner>
        <Button label="Saisir un lien" onPress={() => router.replace('/join')} />
      </Screen>
    );
  }
  if (preview.isPending) return <Loading label="Ouverture de l’invitation…" />;
  if (preview.isError) {
    return (
      <Screen>
        <BackButton fallback={session ? '/events' : '/welcome'} />
        <ErrorState error={preview.error} onRetry={() => preview.refetch()} />
      </Screen>
    );
  }

  const p = preview.data;
  const usable = p.status === 'valid' || p.status === 'already_member';

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Logo />
        <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Le cadeau commun{'\n'}qu’on prépare ensemble
        </T>
      </View>

      {usable && p.role === 'beneficiary' && !p.title ? (
        <View style={{ backgroundColor: colors.night, borderRadius: 24, padding: space.xl, gap: space.md, alignItems: 'center' }}>
          <Mascot size={88} mood="wink" />
          <T v="h2" color={colors.white} style={{ textAlign: 'center' }}>
            Une surprise se prépare pour toi
          </T>
          <T color={colors.nightSub} style={{ textAlign: 'center' }}>
            {p.organizer_name ?? 'Un proche'} et tes proches te préparent quelque chose. Tu découvriras leurs mots et leur cadeau le jour de l’ouverture : rien ne t’est montré avant.
          </T>
        </View>
      ) : usable && p.title ? (
        <Card style={{ gap: space.md }}>
          <Row>
            <Mascot size={44} mood="wink" />
            <T color={colors.inkSoft} style={{ flex: 1 }}>
              {p.organizer_name ?? 'Un proche'} t’invite à préparer un cadeau de groupe
              {p.role && p.role !== 'participant' ? ` en tant que ${ROLE_LABELS[p.role].toLowerCase()}` : ''}.
            </T>
          </Row>
          <T v="h1">{p.title}</T>
          <Row gap={space.lg} style={{ flexWrap: 'wrap' }}>
            {p.gift_at ? (
              <Row gap={6}>
                <CalendarDays size={18} color={colors.coral} strokeWidth={1.75} />
                <T v="small">{formatEventDate(p.gift_at, p.timezone)}</T>
              </Row>
            ) : null}
            <Row gap={6}>
              <Users size={18} color={colors.inkSoft} strokeWidth={1.75} />
              <T v="small">
                {p.member_count} complice{(p.member_count ?? 0) > 1 ? 's' : ''}
              </T>
            </Row>
          </Row>
          {p.role === 'beneficiary' ? (
            <Banner tone="info">Tu es la personne fêtée : tu découvriras les messages et le cadeau à l’ouverture de la capsule. Rien ne te sera montré avant.</Banner>
          ) : null}
        </Card>
      ) : p.status === 'wrong_account' ? (
        <Banner tone="warning" title="Invitation personnelle">
          {`Cette invitation a été envoyée à ${p.email_hint ?? 'une autre adresse'}. Elle ne fonctionne qu’avec le compte de cette adresse : déconnecte-toi puis connecte-toi (ou crée ton compte) avec elle.`}
        </Banner>
      ) : (
        <Banner tone="error" title="Invitation indisponible">
          {INVITATION_MESSAGES[p.status]}
        </Banner>
      )}

      {usable && p.personal && !session ? (
        <Banner tone="info" title="Invitation personnelle">
          {`Utilise l’adresse ${p.email_hint ?? 'qui a reçu l’e-mail'} pour créer ton compte ou te connecter : tu confirmeras avec un code, puis tu choisiras de rejoindre.`}
        </Banner>
      ) : null}

      {acceptError ? <Banner tone="error">{acceptError}</Banner> : null}

      {usable ? (
        session ? (
          p.status === 'already_member' ? (
            <Button label="Ouvrir l’événement" onPress={() => router.replace({ pathname: '/event/[id]', params: { id: p.event_id! } })} />
          ) : (
            <Button label="Rejoindre" onPress={join} loading={accept.isPending} />
          )
        ) : (
          <View style={{ gap: space.md }}>
            <Button label="Créer un compte et rejoindre" onPress={() => goAuth('/sign-up')} />
            <Button label="J’ai déjà un compte" variant="outline" onPress={() => goAuth('/sign-in')} />
          </View>
        )
      ) : p.status === 'wrong_account' && session ? (
        <View style={{ gap: space.md }}>
          <Button
            label="Changer de compte"
            onPress={async () => {
              await signOutEverywhere();
              if (token) await savePendingInvite(token);
              router.replace('/sign-in');
            }}
          />
          <Button label="Retour à l’accueil" variant="outline" onPress={() => router.replace('/events')} />
        </View>
      ) : (
        <Button label={session ? 'Retour à l’accueil' : 'Accueil'} variant="outline" onPress={() => router.replace(session ? '/events' : '/welcome')} />
      )}
    </Screen>
  );
}
