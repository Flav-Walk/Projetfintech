import { BADGE_LABELS, type BadgeKind } from '@complice/shared';
import type { ActivityRow } from './types';

/**
 * Journal d'une cagnotte : regroupe les actions qui se suivent (même type, même jour, < 3 h d'écart)
 * et les formule naturellement. Les participations restent anonymes : jamais de nom, d'avatar
 * ni de montant, même regroupées (l'activité est déjà enregistrée sans auteur, migration 8).
 */
export type JournalFamily = 'group' | 'idea' | 'gift' | 'money' | 'task' | 'done' | 'stamp' | 'role';

export type JournalEntry = {
  key: string;
  family: JournalFamily;
  text: string;
  /** Plus récente action du groupe. */
  at: string;
  count: number;
};

const GAP_MS = 3 * 60 * 60 * 1000;

/** Types regroupables : leur répétition n'apporte rien ligne par ligne. */
const GROUPABLE = new Set(['contribution_confirmed', 'member_joined', 'proposal_added', 'badge_awarded']);

function familyOf(kind: string): JournalFamily {
  switch (kind) {
    case 'event_created':
    case 'member_joined':
      return 'group';
    case 'proposal_added':
      return 'idea';
    case 'gift_selected':
      return 'gift';
    case 'contribution_confirmed':
      return 'money';
    case 'task_claimed':
      return 'task';
    case 'task_done':
      return 'done';
    case 'badge_awarded':
      return 'stamp';
    default:
      return 'role';
  }
}

function names(rows: ActivityRow[]): string {
  const list = [...new Set(rows.map((r) => r.profiles?.display_name ?? 'Quelqu’un'))];
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} et ${list[1]}`;
  return `${list[0]}, ${list[1]} et ${list.length - 2} autre${list.length - 2 > 1 ? 's' : ''}`;
}

const quote = (v: unknown) => `« ${String(v ?? '').trim()} »`;

/** Texte d'une seule action. */
export function journalText(a: ActivityRow): string {
  const who = a.profiles?.display_name ?? 'Quelqu’un';
  switch (a.kind) {
    case 'event_created':
      return `${who} a lancé la cagnotte.`;
    case 'member_joined':
      return `${who} a rejoint le groupe.`;
    case 'proposal_added':
      return a.data.title ? `${who} a proposé ${quote(a.data.title)}.` : `${who} a proposé une idée.`;
    case 'gift_selected':
      return 'Le cadeau est choisi.';
    case 'contribution_confirmed':
      return 'Une nouvelle participation a été enregistrée.';
    case 'task_claimed':
      return a.data.title ? `${who} s’occupe de ${quote(a.data.title)}.` : `${who} a pris une mission.`;
    case 'task_done':
      return a.data.title ? `${who} a terminé ${quote(a.data.title)}.` : `${who} a terminé une mission.`;
    case 'badge_awarded': {
      const b = BADGE_LABELS[a.data.badge as BadgeKind];
      return b ? `${who} a reçu le timbre ${quote(b.title)}.` : `${who} a reçu un timbre.`;
    }
    case 'role_changed':
      return 'Les rôles du groupe ont changé.';
    case 'ownership_transferred':
      return 'L’organisation a changé de mains.';
    default:
      return `${who} a fait avancer les préparatifs.`;
  }
}

function groupText(kind: string, rows: ActivityRow[]): string {
  const n = rows.length;
  switch (kind) {
    case 'contribution_confirmed':
      return `${n} nouvelles participations ont été enregistrées.`;
    case 'member_joined':
      return `${names(rows)} ont rejoint le groupe.`;
    case 'proposal_added':
      return new Set(rows.map((r) => r.actor_id)).size === 1 ? `${names(rows)} a proposé ${n} idées.` : `${n} nouvelles idées proposées par ${names(rows)}.`;
    case 'badge_awarded':
      return `${n} timbres reçus par ${names(rows)}.`;
    default:
      return journalText(rows[0]!);
  }
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Entrées du plus récent au plus ancien (l'ordre de la requête). */
export function buildJournal(rows: ActivityRow[]): JournalEntry[] {
  const out: JournalEntry[] = [];
  let bucket: ActivityRow[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const head = bucket[0]!;
    out.push({
      key: `${head.kind}-${head.id}`,
      family: familyOf(head.kind),
      text: bucket.length > 1 ? groupText(head.kind, bucket) : journalText(head),
      at: head.created_at,
      count: bucket.length,
    });
    bucket = [];
  };
  for (const r of rows) {
    const prev = bucket[bucket.length - 1];
    const joins =
      prev &&
      GROUPABLE.has(r.kind) &&
      prev.kind === r.kind &&
      sameDay(prev.created_at, r.created_at) &&
      Math.abs(new Date(prev.created_at).getTime() - new Date(r.created_at).getTime()) < GAP_MS;
    if (!joins) flush();
    bucket.push(r);
  }
  flush();
  return out;
}
