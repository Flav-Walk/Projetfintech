/** Montants : toujours en centimes entiers. Aucune arithmétique flottante sur l'argent. */

export const CONTRIBUTION_MIN_CENTS = 100; // 1 €
export const CONTRIBUTION_MAX_CENTS = 100_000; // 1 000 €
export const TARGET_MIN_CENTS = 100;
export const TARGET_MAX_CENTS = 10_000_000;
export const SUGGESTED_AMOUNTS_CENTS = [1000, 1500, 2000, 3000] as const;

/** Frais de la simulation : aucun. Le futur prestataire fournira son barème côté serveur. */
export const SIMULATED_FEE_CENTS = 0;

/**
 * Convertit une saisie utilisateur ("15", "15,5", "15.50", "1 200,00 €") en centimes.
 * Renvoie null si la saisie n'est pas un montant valide (plus de 2 décimales, signe, texte).
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [units, decimals = ''] = cleaned.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

const formatters = new Map<string, Intl.NumberFormat>();

/** 13500 -> "135 €" ; 1550 -> "15,50 €" (format français, espaces insécables). */
export function formatCents(cents: number, opts: { forceDecimals?: boolean } = {}): string {
  const hasDecimals = cents % 100 !== 0 || opts.forceDecimals === true;
  const key = hasDecimals ? '2' : '0';
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: hasDecimals ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}

/** Pourcentage arrondi à l'entier inférieur et borné à 100 pour la jauge (135/180 -> 75). */
export function progressPercent(collected: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.floor((collected * 100) / target));
}

export type AmountValidation = { ok: true; cents: number } | { ok: false; reason: 'format' | 'too_small' | 'too_large' };

export function validateContribution(input: string): AmountValidation {
  const cents = parseAmountToCents(input);
  if (cents === null) return { ok: false, reason: 'format' };
  if (cents < CONTRIBUTION_MIN_CENTS) return { ok: false, reason: 'too_small' };
  if (cents > CONTRIBUTION_MAX_CENTS) return { ok: false, reason: 'too_large' };
  return { ok: true, cents };
}
