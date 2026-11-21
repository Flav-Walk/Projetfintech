import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_DELAY_S, classifyOtpError, isPlausibleOtp, normalizeOtp } from '@/lib/otp';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

type Kind = 'signup' | 'recovery';

/**
 * Saisie du code reçu par e-mail (parcours principal, aucun lien à ouvrir).
 * Le code est vérifié par Supabase Auth (`verifyOtp`) :
 * - signup : confirme l'adresse et ouvre la session ; le layout (auth) reprend ensuite l'invitation en attente ;
 * - recovery : ouvre une session de récupération qui ne donne accès qu'à l'écran du nouveau mot de passe.
 */
export default function Verify() {
  // sent=0 : arrivée depuis la connexion d'un compte non confirmé, aucun code n'a encore été demandé ici.
  const params = useLocalSearchParams<{ email?: string; type?: Kind; sent?: string }>();
  const justSent = params.sent !== '0';
  const email = (params.email ?? '').trim().toLowerCase();
  const type: Kind = params.type === 'recovery' ? 'recovery' : 'signup';
  const { setRecovering } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [failures, setFailures] = useState(0);
  // L'e-mail vient d'être demandé : premier renvoi possible après le délai.
  const [wait, setWait] = useState(justSent ? OTP_RESEND_DELAY_S : 0);
  const busy = useRef(false);
  const exhausted = failures >= OTP_MAX_ATTEMPTS;

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!email) {
    return (
      <Screen>
        <BackHeader title="Code de confirmation" fallback="/welcome" />
        <Banner tone="error">Adresse e-mail manquante. Recommence depuis l’écran précédent.</Banner>
        <Button label="Revenir à l’accueil" onPress={() => router.replace('/welcome')} />
      </Screen>
    );
  }

  async function confirm() {
    if (busy.current || exhausted) return;
    setError(null);
    setInfo(null);
    if (!isPlausibleOtp(code)) return setError('Saisis le code complet reçu par e-mail (uniquement des chiffres).');
    busy.current = true;
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code, type: type === 'recovery' ? 'recovery' : 'email' });
    busy.current = false;
    setLoading(false);
    if (!err) {
      // recovery : l'événement PASSWORD_RECOVERY a déjà marqué la récupération ; on va choisir le mot de passe.
      if (type === 'recovery') {
        setRecovering(true);
        router.replace('/reset-password');
      }
      // signup : session ouverte, le layout (auth) redirige vers l'invitation en attente ou les événements.
      return;
    }
    const kind = classifyOtpError(err);
    if (kind === 'invalid_or_expired') {
      const next = failures + 1;
      setFailures(next);
      setCode('');
      setError(
        next >= OTP_MAX_ATTEMPTS
          ? 'Trop d’essais avec ce code. Demande un nouveau code.'
          : 'Code incorrect ou expiré. Vérifie le dernier e-mail reçu (seul le plus récent est valable).',
      );
    } else if (kind === 'rate_limited') {
      setError('Trop d’essais pour le moment. Patiente quelques minutes, puis réessaie.');
    } else {
      setError(authErrorMessage(err));
    }
  }

  async function resend() {
    if (wait > 0 || resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const { error: err } =
      type === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(email)
        : await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    setWait(OTP_RESEND_DELAY_S);
    // Même message que l'adresse corresponde ou non à un compte.
    if (err && !/not found|no user/i.test(err.message)) return setError(authErrorMessage(err));
    setFailures(0);
    setCode('');
    setInfo('Nouveau code demandé. Il remplace le précédent. Vérifie ta boîte et les indésirables.');
  }

  return (
    <Screen>
      <BackHeader title={type === 'recovery' ? 'Code de réinitialisation' : 'Confirme ton adresse'} fallback={type === 'recovery' ? '/forgot-password' : '/sign-up'} />
      <View style={{ alignItems: 'center', paddingVertical: space.md }}>
        <MailCheck size={56} color={colors.violet} strokeWidth={1.5} />
      </View>
      <T color={colors.inkSoft}>
        {type === 'recovery' ? 'Si un compte existe pour ' : justSent ? 'Un code a été demandé pour ' : 'Adresse à confirmer : '}
        <T v="bodyBold">{email}</T>
        {type === 'recovery'
          ? ', un code vient d’être demandé. Saisis-le ici pour choisir un nouveau mot de passe.'
          : justSent
            ? '. Saisis-le ici pour activer ton compte. Pense à regarder dans les indésirables.'
            : '. Saisis le code du dernier e-mail reçu, ou demande un nouveau code.'}
      </T>
      <Field
        label="Code reçu par e-mail"
        value={code}
        onChangeText={(v) => setCode(normalizeOtp(v))}
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        importantForAutofill="yes"
        autoFocus
        editable={!exhausted}
        hint={exhausted ? undefined : `Seul le dernier code reçu est valable. ${OTP_MAX_ATTEMPTS} essais au plus par code.`}
        onSubmitEditing={confirm}
        accessibilityHint="Tu peux coller le code : seuls les chiffres sont gardés."
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {info ? <Banner tone="info">{info}</Banner> : null}
      <Button label="Confirmer" onPress={confirm} loading={loading} disabled={exhausted || !isPlausibleOtp(code)} />
      <Button
        label={wait > 0 ? `Renvoyer le code (dans ${wait} s)` : 'Renvoyer le code'}
        variant="ghost"
        onPress={resend}
        loading={resending}
        disabled={wait > 0}
        accessibilityHint="Un nouveau code ne peut être demandé qu’une fois par minute."
      />
      <Button
        label="Changer d’adresse e-mail"
        variant="outline"
        onPress={() => router.replace(type === 'recovery' ? { pathname: '/forgot-password', params: { email } } : '/sign-up')}
      />
    </Screen>
  );
}
