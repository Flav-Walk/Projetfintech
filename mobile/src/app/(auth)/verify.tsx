import { router, useLocalSearchParams } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Screen, T } from '@/components/ui';
import { authRedirectUrl, useAuth } from '@/lib/auth';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/theme/tokens';

/**
 * Validation de l'adresse e-mail ou du code de réinitialisation.
 * Deux voies : le lien de l'e-mail (ouvre auth/callback) ou le code à 6 chiffres
 * (fonctionne même sans lien profond, utile en Expo Go).
 */
export default function Verify() {
  const { email = '', type = 'signup' } = useLocalSearchParams<{ email?: string; type?: 'signup' | 'recovery' }>();
  const { setRecovering } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify() {
    setError(null);
    if (!/^\d{6,8}$/.test(code.trim())) return setError('Le code contient 6 chiffres.');
    setLoading(true);
    if (type === 'recovery') setRecovering(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type });
    setLoading(false);
    if (err) {
      if (type === 'recovery') setRecovering(false);
      return setError(authErrorMessage(err));
    }
    if (type === 'recovery') router.replace('/reset-password');
    // signup : la session est créée, le layout (auth) redirige.
  }

  async function resend() {
    setError(null);
    setResending(true);
    const { error: err } =
      type === 'recovery'
        ? await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
        : await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } });
    setResending(false);
    if (err) setError(authErrorMessage(err));
    else setInfo('Nouvel e-mail envoyé. Pense à vérifier les indésirables.');
  }

  return (
    <Screen>
      <BackHeader title={type === 'recovery' ? 'Vérifie ta boîte mail' : 'Confirme ton e-mail'} fallback="/welcome" />
      <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
        <MailCheck size={56} color={colors.violet} strokeWidth={1.5} />
      </View>
      <T color={colors.inkSoft}>
        Nous avons envoyé un message à <T v="bodyBold">{email || 'ton adresse'}</T>. Ouvre le lien depuis ce téléphone, ou saisis le code reçu.
      </T>
      <Field label="Code reçu par e-mail" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} placeholder="123456" onSubmitEditing={verify} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {info ? <Banner tone="info">{info}</Banner> : null}
      <Button label="Valider le code" onPress={verify} loading={loading} />
      <Button label="Renvoyer l’e-mail" variant="ghost" onPress={resend} loading={resending} disabled={!email} />
      <Button label="J’ai validé par le lien : me connecter" variant="outline" onPress={() => router.replace({ pathname: '/sign-in', params: { email } })} />
    </Screen>
  );
}
