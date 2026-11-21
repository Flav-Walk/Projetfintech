import type { SupabaseClient } from '@supabase/supabase-js';

export const CALLBACK_ERROR = 'Ce lien est invalide, expiré ou a déjà servi. Ouvre le dernier e-mail sur l’appareil utilisé pour la demande, ou saisis son code dans l’écran de vérification.';

/** Auth failures may arrive in a URL fragment, outside Expo Router's query params. */
export function readAuthCallbackUrl(url: string | null) {
  if (!url) return {};
  try {
    const parsed = new URL(url);
    const values = new URLSearchParams(parsed.search);
    new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => values.set(key, value));
    return Object.fromEntries(
      ['code', 'error', 'error_code', 'error_description', 'type', 'invite', 'sb_flow_id']
        .filter((key) => values.has(key)).map((key) => [key, values.get(key)!]),
    );
  } catch {
    return {};
  }
}

/** Also used by native callbacks, where auth-js cannot read window.location. */
export function exchangeAuthCode(auth: SupabaseClient['auth'], code: string, flowId?: string) {
  return auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
}

export function isRecoveryCallback(data: object, type?: string) {
  return ('redirectType' in data && data.redirectType === 'recovery') || type === 'recovery';
}
