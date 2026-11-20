import { Redirect } from 'expo-router';
import { Loading } from '@/components/states';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <Loading />;
  return <Redirect href={session ? '/events' : '/welcome'} />;
}
