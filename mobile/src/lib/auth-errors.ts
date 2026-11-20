/** Messages Auth en français, sans révéler si un compte existe. */
export function authErrorMessage(err: { message?: string; status?: number } | null): string {
  const m = err?.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/email not confirmed/i.test(m)) return 'Confirme d’abord ton adresse e-mail (lien ou code reçu par e-mail).';
  if (/password should be at least|weak password/i.test(m)) return 'Mot de passe trop faible : 8 caractères minimum, avec lettres et chiffres.';
  if (/rate limit|too many/i.test(m) || err?.status === 429) return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
  if (/token has expired|otp.*expired|invalid.*otp|token.*invalid/i.test(m)) return 'Code invalide ou expiré. Demande un nouveau code.';
  if (/same.*password|different from the old/i.test(m)) return 'Choisis un mot de passe différent de l’ancien.';
  if (/network|fetch/i.test(m)) return 'Connexion impossible. Vérifie ton réseau et réessaie.';
  return 'Une erreur est survenue. Réessaie dans un instant.';
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return '8 caractères minimum.';
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Mélange lettres et chiffres.';
  return null;
}
