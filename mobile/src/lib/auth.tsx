import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearLocalUserData } from './local-drafts';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  /** Vrai après un lien de réinitialisation : l'écran de nouveau mot de passe doit s'afficher. */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
  /** Vrai si la session a pris fin sans déconnexion volontaire (jeton expiré ou révoqué). */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null, loading: true, recovering: false, setRecovering: () => {}, sessionExpired: false, clearSessionExpired: () => {},
});

let voluntarySignOut = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      // Jeton de rafraîchissement invalide au démarrage : session locale effacée, message à l'accueil.
      if (error) {
        setSessionExpired(true);
        void supabase.auth.signOut({ scope: 'local' });
      }
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_IN') setSessionExpired(false);
      if (event === 'SIGNED_OUT') {
        if (!voluntarySignOut) setSessionExpired(true);
        voluntarySignOut = false;
        setRecovering(false);
      }
      // Changement d'utilisateur : aucune donnée du compte précédent ne doit rester en cache.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo(
    () => ({ session, loading, recovering, setRecovering, sessionExpired, clearSessionExpired: () => setSessionExpired(false) }),
    [session, loading, recovering, sessionExpired],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * URL de retour des e-mails Auth (fonctionne en Expo Go : exp://…, et en build : complice://…).
 * Le jeton d'une invitation en cours y est ajouté : après confirmation, l'utilisateur rejoint le bon
 * groupe même si le stockage local a été vidé entre-temps.
 */
export function authRedirectUrl(invite?: string | null) {
  return Linking.createURL('/auth/callback', invite ? { queryParams: { invite } } : undefined);
}

/** Déconnexion : session, brouillons locaux et invitation en attente. */
export async function signOutEverywhere() {
  voluntarySignOut = true;
  await clearLocalUserData();
  const { error } = await supabase.auth.signOut();
  // Hors ligne : la session locale est tout de même effacée.
  if (error) await supabase.auth.signOut({ scope: 'local' });
}

/** Après suppression du compte : même nettoyage, sans message d'expiration. */
export async function signOutAfterDeletion() {
  voluntarySignOut = true;
  await clearLocalUserData();
  await supabase.auth.signOut({ scope: 'local' });
}
