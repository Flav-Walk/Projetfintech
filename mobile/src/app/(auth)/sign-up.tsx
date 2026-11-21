import { router } from 'expo-router';
import { Mail, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { BackHeader } from '@/components/back-header';
import { PasswordField } from '@/components/password-field';
import { Banner, Button, Field, Row, Screen, T } from '@/components/ui';
import { authErrorMessage, isEmail, passwordProblem } from '@/lib/auth-errors';
import { peekPendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/tokens';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    peekPendingInvite().then(setInvite);
  }, []);

  async function submit() {
    if (loading) return;
    const next: typeof errors = {};
    if (name.trim().length < 1 || name.trim().length > 40) next.name = 'Ton prénom ou pseudo (40 caractères max).';
    if (!isEmail(email)) next.email = 'Adresse e-mail invalide.';
    const pw = passwordProblem(password);
    if (pw) next.password = pw;
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    // Confirmation par code saisi dans l'app : aucune adresse de retour (le modèle d'e-mail n'a pas de lien).
    // L'invitation en cours reste gardée sur le téléphone et sera reprise après la saisie du code.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (error) return setErrors({ form: authErrorMessage(error) });
    // Confirmation désactivée côté projet : la session existe déjà, le layout redirige.
    // Sinon (cas normal, et aussi adresse déjà utilisée : même réponse, sans révéler l'existence du compte).
    if (!data.session) router.replace({ pathname: '/verify', params: { email: email.trim().toLowerCase(), type: 'signup' } });
  }

  return (
    <Screen>
      <BackHeader title="Créer un compte" subtitle="Quelques secondes, et tu pourras préparer le cadeau avec le groupe." fallback="/welcome" />
      {invite ? (
        <Banner tone="info" title="Ton invitation est gardée">
          Après la saisie du code reçu par e-mail, tu arriveras directement dans le groupe.
        </Banner>
      ) : null}
      <Field label="Prénom ou pseudo" value={name} onChangeText={setName} autoComplete="given-name" textContentType="givenName" placeholder="Léa" error={errors.name} icon={<User size={20} color={colors.inkSoft} strokeWidth={1.75} />} maxLength={40} hint="C’est ce que verra le groupe." />
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" placeholder="toi@exemple.fr" error={errors.email} icon={<Mail size={20} color={colors.inkSoft} strokeWidth={1.75} />} />
      <PasswordField value={password} onChangeText={setPassword} showRules autoComplete="new-password" textContentType="newPassword" error={errors.password} onSubmitEditing={submit} />
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
