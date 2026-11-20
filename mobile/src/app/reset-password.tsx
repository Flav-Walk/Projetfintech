import { Redirect, router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { Banner, Button, Field, Screen, T } from '@/components/ui';
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
      <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" icon={<Lock size={20} color={colors.inkSoft} strokeWidth={1.75} />} hint="8 caractères minimum, lettres et chiffres." />
      <Field label="Confirmer" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} icon={<Lock size={20} color={colors.inkSoft} strokeWidth={1.75} />} />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button label="Enregistrer" onPress={submit} loading={loading} />
    </Screen>
  );
}
