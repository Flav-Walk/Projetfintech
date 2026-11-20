import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  loading: boolean;
  /** Vrai après un lien de réinitialisation : l'écran de nouveau mot de passe doit s'afficher. */
  recovering: boolean;
  setRecovering: (v: boolean) => void;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true, recovering: false, setRecovering: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // Changement d'utilisateur : aucune donnée du compte précédent ne doit rester en cache.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo(() => ({ session, loading, recovering, setRecovering }), [session, loading, recovering]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** URL de retour des e-mails Auth (fonctionne en Expo Go : exp://…, et en build : complice://…). */
export function authRedirectUrl() {
  return Linking.createURL('/auth/callback');
}
