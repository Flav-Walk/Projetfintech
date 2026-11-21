/**
 * Codes à usage unique envoyés par Supabase Auth (confirmation d'inscription, mot de passe oublié).
 * Le code est généré et vérifié par Supabase (`verifyOtp`), jamais par l'app ni par notre API.
 * Sa longueur dépend du réglage « Email OTP Length » du projet (6 à 10 chiffres) : on ne la suppose pas.
 */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 10;

/** Essais erronés tolérés pour un même code avant d'exiger un nouveau code (Supabase limite aussi par IP). */
export const OTP_MAX_ATTEMPTS = 5;

/** Délai minimal entre deux envois, aligné sur la fréquence minimale de Supabase (60 s par adresse). */
export const OTP_RESEND_DELAY_S = 60;

/**
 * Nettoie une saisie ou un collage : « 123 456 », « Code : 12345678 » ou un code avec tirets.
 * Seuls les chiffres sont gardés, dans la limite de la longueur maximale.
 */
export function normalizeOtp(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_MAX_LENGTH);
}

export function isPlausibleOtp(code: string): boolean {
  return code.length >= OTP_MIN_LENGTH && code.length <= OTP_MAX_LENGTH && /^\d+$/.test(code);
}

export type OtpFailure = 'invalid_or_expired' | 'rate_limited' | 'network' | 'other';

/** Classe une erreur de `verifyOtp`. Supabase ne distingue pas « faux » et « expiré » (même code otp_expired). */
export function classifyOtpError(err: { message?: string; status?: number; code?: string } | null): OtpFailure {
  const m = err?.message ?? '';
  const code = err?.code ?? '';
  if (code === 'over_request_rate_limit' || err?.status === 429 || /rate limit|too many/i.test(m)) return 'rate_limited';
  if (code === 'otp_expired' || code === 'otp_disabled' || /token has expired|is invalid|otp/i.test(m)) return 'invalid_or_expired';
  if (/network|fetch/i.test(m)) return 'network';
  return 'other';
}
