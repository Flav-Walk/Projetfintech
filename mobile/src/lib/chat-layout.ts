/**
 * Mise en forme de la discussion (logique pure, testée) : messages du plus récent au plus ancien
 * (liste inversée), regroupés par auteur quand ils se suivent à moins de 5 minutes, séparateurs de jour.
 */
export type ChatMsg = { key: string; author: string | null; created_at: string };
export type ChatRow<M extends ChatMsg> =
  | { kind: 'msg'; msg: M; firstOfGroup: boolean; lastOfGroup: boolean }
  | { kind: 'day'; key: string; label: string };

const GROUP_GAP_MS = 5 * 60 * 1000;

function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function dayLabel(iso: string, tz: string, now = Date.now()) {
  const k = dayKey(iso, tz);
  if (k === dayKey(new Date(now).toISOString(), tz)) return 'Aujourd’hui';
  if (k === dayKey(new Date(now - 86400000).toISOString(), tz)) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}

/** Entrée : du plus récent au plus ancien. Sortie : même ordre, avec séparateurs placés au-dessus de chaque jour. */
export function layoutChat<M extends ChatMsg>(newestFirst: M[], tz: string, now = Date.now()): ChatRow<M>[] {
  const out: ChatRow<M>[] = [];
  for (let i = 0; i < newestFirst.length; i++) {
    const m = newestFirst[i]!;
    const newer = newestFirst[i - 1];
    const older = newestFirst[i + 1];
    const sameAs = (o: M | undefined) =>
      !!o && o.author === m.author && Math.abs(new Date(o.created_at).getTime() - new Date(m.created_at).getTime()) < GROUP_GAP_MS && dayKey(o.created_at, tz) === dayKey(m.created_at, tz);
    out.push({ kind: 'msg', msg: m, firstOfGroup: !sameAs(older), lastOfGroup: !sameAs(newer) });
    if (!older || dayKey(older.created_at, tz) !== dayKey(m.created_at, tz)) {
      out.push({ kind: 'day', key: `day-${dayKey(m.created_at, tz)}`, label: dayLabel(m.created_at, tz, now) });
    }
  }
  return out;
}
