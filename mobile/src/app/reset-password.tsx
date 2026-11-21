import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { PasswordField } from '@/components/password-field';
import { Banner, Button, Screen, T } from '@/components/ui';
import { signOutEverywhere, useAuth } from '@/lib/auth';
import { authErrorMessage, passwordProblem } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

/**
 * Nouveau mot de passe. Accessible seulement après validation d'un code de réinitialisation
 * (session de récupération + indicateur `recovering`) : une session ordinaire est renvoyée vers l'app.
 */
export default function ResetPassword() {
  const { session, loading: authLoading, recovering, setRecovering } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  if (authLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!recovering) return <Redirect href="/after-auth" />;

  async function submit() {
    if (busy.current) return;
    setError(null);
    const pw = passwordProblem(password);
    if (pw) return setError(pw);
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    busy.current = true;
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    busy.current = false;
    setLoading(false);
    if (err) return setError(authErrorMessage(err));
    setRecovering(false);
    router.replace('/after-auth');
  }

  async function cancel() {
    // Abandon : la session de récupération est fermée, l'ancien mot de passe reste valable.
    await signOutEverywhere();
    router.replace('/sign-in');
  }

  return (
    <Screen>
      <T v="h1">Nouveau mot de passe</T>
      <T color={colors.inkSoft}>Code validé. Choisis un mot de passe que tu n’utilises nulle part ailleurs.</T>
      <PasswordField label="Nouveau mot de passe" value={password} onChangeText={setPassword} showRules autoComplete="new-password" textContentType="newPassword" />
      <PasswordField label="Confirmer" value={confirm} onChangeText={setConfirm} autoComplete="new-password" textContentType="newPassword" onSubmitEditing={submit} error={confirm && confirm !== password ? 'Les deux mots de passe sont différents.' : null} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Enregistrer" onPress={submit} loading={loading} />
      <Button label="Annuler" variant="ghost" onPress={cancel} />
    </Screen>
  );
}
