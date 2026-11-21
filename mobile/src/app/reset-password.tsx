import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { PasswordField } from '@/components/password-field';
import { Banner, Button, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { authErrorMessage, passwordProblem } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function ResetPassword() {
  const { session, setRecovering } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;

  async function submit() {
    if (loading) return;
    setError(null);
    const pw = passwordProblem(password);
    if (pw) return setError(pw);
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    setRecovering(false);
    router.replace('/after-auth');
  }

  return (
    <Screen>
      <T v="h1">Nouveau mot de passe</T>
      <T color={colors.inkSoft}>Choisis un mot de passe que tu n’utilises nulle part ailleurs.</T>
      <PasswordField label="Nouveau mot de passe" value={password} onChangeText={setPassword} showRules autoComplete="new-password" textContentType="newPassword" />
      <PasswordField label="Confirmer" value={confirm} onChangeText={setConfirm} autoComplete="new-password" onSubmitEditing={submit} error={confirm && confirm !== password ? 'Les deux mots de passe sont différents.' : null} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Enregistrer" onPress={submit} loading={loading} />
    </Screen>
  );
}
