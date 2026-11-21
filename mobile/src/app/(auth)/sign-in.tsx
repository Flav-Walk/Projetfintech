import { router, useLocalSearchParams } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { PasswordField } from '@/components/password-field';
import { Banner, Button, Field, Row, Screen, T } from '@/components/ui';
import { authErrorMessage, isEmail } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function SignIn() {
  const params = useLocalSearchParams<{ email?: string; notice?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  async function submit() {
    if (loading) return;
    setError(null);
    setUnconfirmed(false);
    if (!isEmail(email)) return setError('Saisis une adresse e-mail valide.');
    if (password.length < 1) return setError('Saisis ton mot de passe.');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) {
      if (/not confirmed/i.test(err.message)) setUnconfirmed(true);
      setError(authErrorMessage(err));
    }
    // En cas de succès, le layout (auth) redirige automatiquement.
  }

  return (
    <Screen>
      <BackHeader title="Se connecter" fallback="/welcome" />
      {params.notice === 'password-updated' ? <Banner tone="info">Mot de passe mis à jour. Connecte-toi avec le nouveau.</Banner> : null}
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="toi@exemple.fr" icon={<Mail size={20} color={colors.inkSoft} strokeWidth={1.75} />} />
      <PasswordField value={password} onChangeText={setPassword} autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {unconfirmed ? (
        <Button label="Saisir le code de confirmation" variant="outline" onPress={() => router.push({ pathname: '/verify', params: { email: email.trim(), type: 'signup' } })} />
      ) : null}
      <Button label="Se connecter" onPress={submit} loading={loading} />
      <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => router.push({ pathname: '/forgot-password', params: { email } })} />
      <Row style={{ justifyContent: 'center' }} gap={6}>
        <T color={colors.inkSoft}>Pas encore de compte ?</T>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/sign-up')} hitSlop={12}>
          <T v="bodyBold" color={colors.coral}>
            Créer un compte
          </T>
        </Pressable>
      </Row>
    </Screen>
  );
}
