import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Screen } from '@/components/ui';
import { authErrorMessage, isEmail } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

/** Mot de passe oublié : e-mail → code saisi dans l'app → nouveau mot de passe. */
export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  async function submit() {
    if (busy.current) return;
    setError(null);
    if (!isEmail(email)) return setError('Saisis une adresse e-mail valide.');
    const address = email.trim().toLowerCase();
    busy.current = true;
    setLoading(true);
    // Sans adresse de retour : le modèle « Reset password » ne contient que le code.
    const { error: err } = await supabase.auth.resetPasswordForEmail(address);
    busy.current = false;
    setLoading(false);
    // Même suite que le compte existe ou non (pas d'énumération des comptes).
    if (err && !/user not found/i.test(err.message)) return setError(authErrorMessage(err));
    router.replace({ pathname: '/verify', params: { email: address, type: 'recovery' } });
  }

  return (
    <Screen>
      <BackHeader title="Mot de passe oublié" subtitle="Indique ton e-mail : si un compte existe, tu recevras un code à saisir dans l’app pour choisir un nouveau mot de passe." fallback="/sign-in" />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="toi@exemple.fr" icon={<Mail size={20} color={colors.inkSoft} strokeWidth={1.75} />} onSubmitEditing={submit} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Recevoir un code" onPress={submit} loading={loading} />
    </Screen>
  );
}
