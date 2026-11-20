import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Screen } from '@/components/ui';
import { authRedirectUrl } from '@/lib/auth';
import { authErrorMessage, isEmail } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (!isEmail(email)) return setError('Saisis une adresse e-mail valide.');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl() });
    setLoading(false);
    // Même réponse que le compte existe ou non (pas d'énumération des comptes).
    if (err && !/user not found/i.test(err.message)) return setError(authErrorMessage(err));
    router.replace({ pathname: '/verify', params: { email: email.trim(), type: 'recovery' } });
  }

  return (
    <Screen>
      <BackHeader title="Mot de passe oublié" subtitle="Indique ton e-mail : si un compte existe, tu recevras un lien et un code pour choisir un nouveau mot de passe." fallback="/sign-in" />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="toi@exemple.fr" icon={<Mail size={20} color={colors.inkSoft} strokeWidth={1.75} />} onSubmitEditing={submit} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Recevoir le lien" onPress={submit} loading={loading} />
    </Screen>
  );
}
