import { router } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { Banner, Button, Field, Row, Screen, T } from '@/components/ui';
import { authRedirectUrl } from '@/lib/auth';
import { authErrorMessage, isEmail, passwordProblem } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function submit() {
    const next: typeof errors = {};
    if (name.trim().length < 1 || name.trim().length > 40) next.name = 'Ton prénom (40 caractères max).';
    if (!isEmail(email)) next.email = 'Adresse e-mail invalide.';
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: authRedirectUrl() },
    });
    setLoading(false);
    if (error) return setErrors({ form: authErrorMessage(error) });
    // Confirmation désactivée côté projet : la session existe déjà, le layout redirige.
    if (!data.session) router.replace({ pathname: '/verify', params: { email: email.trim(), type: 'signup' } });
  }

  return (
    <Screen>
      <BackHeader title="Créer un compte" subtitle="Quelques secondes, et tu pourras préparer le cadeau avec le groupe." fallback="/welcome" />
      <Field label="Prénom" value={name} onChangeText={setName} autoComplete="given-name" textContentType="givenName" placeholder="Léa" error={errors.name} icon={<User size={20} color={colors.inkSoft} strokeWidth={1.75} />} maxLength={40} />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="toi@exemple.fr" error={errors.email} icon={<Mail size={20} color={colors.inkSoft} strokeWidth={1.75} />} />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="8 caractères minimum, lettres et chiffres." error={errors.password} icon={<Lock size={20} color={colors.inkSoft} strokeWidth={1.75} />} onSubmitEditing={submit} />
      {errors.form ? <Banner tone="error">{errors.form}</Banner> : null}
      <Banner tone="info" title="Tes données">
        Nous gardons ton prénom, ton e-mail et ce que tu ajoutes dans tes groupes. Ta participation financière reste privée. Tu peux supprimer ton compte à tout moment depuis ton profil.
      </Banner>
      <Button label="Créer mon compte" onPress={submit} loading={loading} />
      <Row style={{ justifyContent: 'center' }} gap={6}>
        <T color={colors.inkSoft}>Déjà un compte ?</T>
        <Pressable accessibilityRole="link" onPress={() => router.replace('/sign-in')} hitSlop={12}>
          <T v="bodyBold" color={colors.coral}>
            Se connecter
          </T>
        </Pressable>
      </Row>
    </Screen>
  );
}
