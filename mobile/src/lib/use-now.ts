import { useEffect, useState } from 'react';

/** Heure courante, rafraîchie chaque minute (rendu pur, échéances à jour sans compte à rebours). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
