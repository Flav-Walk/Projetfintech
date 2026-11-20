/**
 * Configuration publique de l'app (variables EXPO_PUBLIC_*, intégrées au bundle).
 * Aucune valeur secrète ici : la clé publishable est conçue pour être exposée, la RLS protège les données.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  /** URL de l'API (backend local via IP du PC, ou Render). Sans barre finale. */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, ''),
};

export const isSupabaseConfigured = env.supabaseUrl.startsWith('https://') && env.supabaseKey.length > 20;
export const isApiConfigured = /^https?:\/\//.test(env.apiUrl);

/** Lien partageable d'une invitation : page web de l'API si configurée, sinon lien profond direct. */
export function invitationShareUrl(token: string): string {
  return isApiConfigured ? `${env.apiUrl}/i/${token}` : `complice://invite/${token}`;
}
