import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Screen, T } from '@/components/ui';
import { authRedirectUrl, useAuth } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { peekPendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

/** Délai entre deux envois (Supabase limite aussi côté serveur). */
const RESEND_DELAY_S = 60;

/**
 * Validation de l'adresse e-mail ou du code de réinitialisation.
 * Deux voies : le lien de l'e-mail (ouvre auth/callback) ou le code à 6 chiffres
 * (fonctionne même sans lien profond, utile en Expo Go ou sur un autre appareil).
 */
export default function Verify() {
  const { email = '', type = 'signup' } = useLocalSearchParams<{ email?: string; type?: 'signup' | 'recovery' }>();
  const { setRecovering } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // L'e-mail vient de partir : premier renvoi possible dans une minute.
  const [wait, setWait] = useState(RESEND_DELAY_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify() {
    if (loading) return;
    setError(null);
    if (!/^\d{6,8}$/.test(code.trim())) return setError('Saisis les 6 à 8 chiffres du code reçu.');
    setLoading(true);
    if (type === 'recovery') setRecovering(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type });
    setLoading(false);
    if (err) {
      if (type === 'recovery') setRecovering(false);
      return setError(authErrorMessage(err));
    }
    if (type === 'recovery') router.replace('/reset-password');
    // signup : la session est créée, le layout (auth) redirige vers l'invitation en attente ou l'accueil.
  }

  async function resend() {
    if (wait > 0 || resending) return;
    setError(null);
    setInfo(null);
    setResending(true);
    const invite = await peekPendingInvite();
    const { error: err } =
      type === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl(invite) })
        : await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl(invite) } });
    setResending(false);
    setWait(RESEND_DELAY_S);
    // Même message que l'adresse corresponde ou non à un compte.
    if (err && !/not found|no user/i.test(err.message)) setError(authErrorMessage(err));
    else setInfo('Si un envoi est possible pour cette adresse, l’e-mail a été demandé. Vérifie ta boîte et les indésirables.');
  }

  return (
    <Screen>
      <BackHeader title={type === 'recovery' ? 'Vérifie ta boîte mail' : 'Confirme ton e-mail'} fallback="/welcome" />
      <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <MailCheck size={56} color={colors.violet} strokeWidth={1.5} />
      </View>
      <T color={colors.inkSoft}>
        Si un compte peut être {type === 'recovery' ? 'réinitialisé' : 'activé'} avec <T v="bodyBold">{email || 'ton adresse'}</T>, un e-mail a été demandé. Vérifie ta boîte et les indésirables. Ouvre le lien sur l’appareil utilisé pour la demande, ou saisis ici le code reçu.
      </T>
      <Field label="Code reçu par e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} placeholder="123456" onSubmitEditing={verify} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {info ? <Banner tone="info">{info}</Banner> : null}
      <Button label="Valider le code" onPress={verify} loading={loading} />
      <Button
        label={wait > 0 ? `Renvoyer l’e-mail (dans ${wait} s)` : 'Renvoyer l’e-mail'}
        variant="ghost"
        onPress={resend}
        loading={resending}
        disabled={!email || wait > 0}
        accessibilityHint="Un nouvel e-mail ne peut être demandé qu’une fois par minute."
      />
      <Button label="J’ai validé par le lien : me connecter" variant="outline" onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
    </Screen>
  );
}
