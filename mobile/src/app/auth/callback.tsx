import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/states';
import { Banner, Button, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/**
 * Retour des liens e-mail Supabase (PKCE) : ?code=… pour confirmation et réinitialisation.
 * URL à autoriser dans Supabase > Authentication > URL Configuration (voir docs/SETUP.md).
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error_description?: string; type?: string }>();
  const { setRecovering } = useAuth();
  const [exchangeError, setError] = useState<string | null>(null);
  const error =
    exchangeError ?? params.error_description ?? (!params.code ? 'Lien incomplet. Ouvre le lien le plus récent reçu par e-mail.' : null);

  useEffect(() => {
    if (!params.code) return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase.auth.exchangeCodeForSession(params.code!);
      if (cancelled) return;
      if (err || !data.session) {
        setError('Ce lien a expiré ou a déjà été utilisé. Demande un nouvel e-mail, ou saisis le code reçu.');
        return;
      }
      // Le type n'est pas toujours transmis : l'événement PASSWORD_RECOVERY de l'AuthProvider couvre l'autre cas.
      if (params.type === 'recovery') {
        setRecovering(true);
        router.replace('/reset-password');
      } else {
        router.replace('/after-auth');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.error_description, params.type, setRecovering]);

  if (!error) return <Loading label="Connexion en cours…" />;
  return (
    <Screen>
      <T v="h1">Lien non valide</T>
      <Banner tone="error">{error}</Banner>
      <Button label="Revenir à la connexion" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
