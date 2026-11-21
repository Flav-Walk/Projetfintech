/** Messages Auth en français, sans révéler si un compte existe. */
export function authErrorMessage(err: { message?: string; status?: number; code?: string } | null): string {
  const m = err?.message ?? '';
  const code = err?.code ?? '';
  if (code === 'email_address_invalid' || /email address .* is invalid/i.test(m)) return 'Cette adresse e-mail n’est pas acceptée. Vérifie-la ou utilise une autre adresse.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Trop de demandes pour cette adresse. Patiente quelques minutes avant de réessayer.';
  if (code === 'weak_password') return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(m)) return 'Confirme d’abord ton adresse e-mail (lien ou code reçu par e-mail).';
  if (/password should be at least|weak password/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
  if (/rate limit|too many/i.test(m) || err?.status === 429) return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  if (/token has expired|otp.*expired|invalid.*otp|token.*invalid/i.test(m)) return 'Code invalide ou expiré. Demande un nouveau code.';
  if (/same.*password|different from the old/i.test(m)) return 'Choisis un mot de passe différent de l’ancien.';
  if (/network|fetch/i.test(m)) return 'Connexion impossible. Vérifie ton réseau et réessaie.';
  if (/sending.*(confirmation|recovery|magic)|smtp|email.*(send|deliver)/i.test(m)) return 'L’e-mail n’a pas pu partir pour le moment. Réessaie dans quelques minutes.';
  if (/refresh token|session.*(expired|missing|not found)|jwt expired/i.test(m)) return 'Ta session a expiré. Reconnecte-toi.';
  return 'Une erreur est survenue. Réessaie dans un instant.';
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** Règles affichées pendant la saisie et appliquées à la validation (mêmes critères). */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { label: 'Au moins une lettre', test: (p) => /\p{L}/u.test(p) },
  { label: 'Au moins un chiffre', test: (p) => /\d/.test(p) },
];

export function passwordProblem(p: string): string | null {
  const failed = PASSWORD_RULES.find((r) => !r.test(p));
  return failed ? `Mot de passe : ${failed.label.toLowerCase()}.` : null;
}
