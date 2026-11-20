import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/states';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

/** Écrans accessibles sans session. Une session active renvoie vers l'app (sauf réinitialisation en cours). */
export default function AuthLayout() {
  const { session, loading, recovering } = useAuth();
  if (loading) return <Loading />;
  if (session && !recovering) return <Redirect href="/after-auth" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
