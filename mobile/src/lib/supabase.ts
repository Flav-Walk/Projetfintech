import 'react-native-url-polyfill/auto';
import './auth-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';

/**
 * Client Supabase unique. Session persistée dans AsyncStorage (recommandation Supabase pour Expo).
 * flowType 'pkce' : les liens de confirmation et de réinitialisation renvoient un `code`
 * échangé contre une session dans l'écran auth/callback.
 */
export const supabase = createClient(env.supabaseUrl || 'https://invalid.local', env.supabaseKey || 'missing', {
  auth: {
    storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

// Rafraîchissement du jeton seulement quand l'app est au premier plan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Lève l'erreur Supabase pour que React Query la gère ; renvoie les données typées. */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
