/**
 * Compte à rebours de la capsule, en heure serveur estimée : l'écart serveur − téléphone est mesuré à chaque
 * réponse du serveur. Le compte à rebours n'autorise rien : seule la base décide de l'ouverture.
 */
/** Écart serveur − téléphone (ms), mesuré à la réception de la réponse. */
export function clockOffset(serverNowIso: string, receivedAt: number): number {
  return new Date(serverNowIso).getTime() - receivedAt;
}

/** Temps restant avant l'ouverture, en heure serveur estimée. Jamais négatif. */
export function remainingMs(revealAtIso: string, offset: number, deviceNow = Date.now()): number {
  return Math.max(0, new Date(revealAtIso).getTime() - (deviceNow + offset));
}

/** « 19 j 04 h 12 min », « 4 h 05 min 09 s » sous un jour, « 0 s » à l'échéance. */
export function countdownParts(ms: number): { value: string; unit: string }[] {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return [{ value: String(d), unit: d > 1 ? 'jours' : 'jour' }, { value: pad(h), unit: 'h' }, { value: pad(m), unit: 'min' }];
  return [{ value: pad(h), unit: 'h' }, { value: pad(m), unit: 'min' }, { value: pad(sec), unit: 's' }];
}

