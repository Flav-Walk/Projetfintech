import { Redirect, Stack } from 'expo-router';
import { Loading } from '@/components/states';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme/tokens';

/** Espace connecté. La protection réelle des données est assurée par la RLS, pas par ce garde. */
export default function AppLayout() {
  const { session, loading, recovering } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/welcome" />;
  if (recovering) return <Redirect href="/reset-password" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
