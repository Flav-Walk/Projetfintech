import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { Loading } from '@/components/states';
import { useAuth } from '@/lib/auth';
import { takePendingInvite } from '@/lib/pending-invite';

/** Après connexion ou inscription : reprend l'invitation en attente, sinon la liste des événements. */
export default function AfterAuth() {
  const { session, recovering } = useAuth();

  useEffect(() => {
    if (!session) return;
    if (recovering) {
      router.replace('/reset-password');
      return;
    }
    takePendingInvite().then((token) => {
      if (token) router.replace({ pathname: '/invite/[token]', params: { token, auto: '1' } });
      else router.replace('/events');
    });
  }, [session, recovering]);

  if (!session) return <Redirect href="/welcome" />;
  return <Loading />;
}
