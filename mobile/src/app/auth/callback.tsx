import { router, useLocalSearchParams } from 'expo-router';
import { useLinkingURL } from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Loading } from '@/components/states';
import { Banner, Button, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CALLBACK_ERROR, exchangeAuthCode, isRecoveryCallback, readAuthCallbackUrl } from '@/lib/auth-callback';
import { extractInviteToken, savePendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';

/**
 * Retour des liens e-mail Supabase (PKCE) : ?code=… pour confirmation et réinitialisation.
 * URL à autoriser dans Supabase > Authentication > URL Configuration (voir docs/SETUP.md).
 */
export default function AuthCallback() {
  const query = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string; type?: string; invite?: string; sb_flow_id?: string }>();
  const params = { ...readAuthCallbackUrl(useLinkingURL()), ...query };
  const { setRecovering } = useAuth();
  const [exchangeError, setError] = useState<string | null>(null);
  // React Strict Mode replays effects; a PKCE code must only be exchanged once.
  const exchange = useRef<{ key: string; promise: ReturnType<typeof exchangeAuthCode> } | null>(null);
  const failed = Boolean(params.error || params.error_code || params.error_description);
  const error =
    exchangeError ?? (failed ? CALLBACK_ERROR : !params.code ? 'Lien incomplet. Ouvre le lien le plus récent reçu par e-mail.' : null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Invitation portée par le lien de confirmation : prioritaire sur le stockage local.
      const invite = extractInviteToken(params.invite ?? '');
      if (invite) await savePendingInvite(invite);
      if (failed || !params.code) return;
      const key = JSON.stringify([params.code, params.sb_flow_id]);
      if (exchange.current?.key !== key) {
        exchange.current = { key, promise: exchangeAuthCode(supabase.auth, params.code, params.sb_flow_id) };
      }
      const { data, error: err } = await exchange.current.promise;
      if (cancelled) return;
      if (err || !data.session) {
        setError(
          /network|fetch/i.test(err?.message ?? '')
            ? 'Connexion impossible. Vérifie ton réseau, puis rouvre le lien.'
            : CALLBACK_ERROR,
        );
        return;
      }
      // Le type n'est pas toujours transmis : l'événement PASSWORD_RECOVERY de l'AuthProvider couvre l'autre cas.
      if (isRecoveryCallback(data, params.type)) {
        setRecovering(true);
        router.replace('/reset-password');
      } else {
        router.replace('/after-auth');
      }
    })().catch(() => {
      if (!cancelled) setError('Connexion impossible. Vérifie ton réseau, puis rouvre le lien.');
    });
    return () => {
      cancelled = true;
    };
  }, [params.code, params.sb_flow_id, failed, params.type, params.invite, setRecovering]);

  if (!error) return <Loading label="Connexion en cours…" />;
  return (
    <Screen>
      <T v="h1">Lien non valide</T>
      <Banner tone="error">{error}</Banner>
      <Button label="Revenir à la connexion" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
