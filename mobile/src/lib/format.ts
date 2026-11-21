import { BADGE_LABELS, type BadgeKind } from '@complice/shared';
import type { ActivityRow } from './types';

/** Fuseau de l'appareil (repli Europe/Paris). */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/** « 12 décembre · 19 h » dans le fuseau de l'événement. */
export function formatEventDate(iso: string, timeZone = 'Europe/Paris', withTime = true): string {
  const d = new Date(iso);
  try {
    const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone }).format(d);
    if (!withTime) return day;
    const parts = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).formatToParts(d);
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${day} · ${h} h${m === '00' ? '' : ` ${m}`}`;
  } catch {
    return d.toLocaleString('fr-FR');
  }
}

export function formatShortDate(iso: string, timeZone = 'Europe/Paris'): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString('fr-FR');
  }
}

/** « il y a 2 h », « à l'instant » — sans fausse urgence. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'à l’instant';
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

/** Durée restante neutre (« dans 3 jours »), sans compte à rebours à la seconde. */
export function timeUntil(iso: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return 'terminé';
  const d = Math.floor(s / 86400);
  if (d >= 2) return `dans ${d} jours`;
  if (d === 1) return 'demain';
  return 'aujourd’hui';
}

export function activityLabel(a: ActivityRow): string {
  const who = a.profiles?.display_name ?? 'Quelqu’un';
  switch (a.kind) {
    case 'event_created':
      return `${who} a créé l’événement`;
    case 'member_joined':
      return `${who} a rejoint le groupe`;
    case 'proposal_added':
      return a.data.title ? `${who} a proposé « ${String(a.data.title)} »` : `${who} a ajouté une idée`;
    case 'gift_selected':
      return `${who} a choisi le cadeau`;
    case 'contribution_confirmed':
      // Annonce anonyme (migration 8) : ni nom ni montant.
      return 'Une nouvelle participation a rejoint la cagnotte';
    case 'task_claimed':
      return `${who} a pris la mission « ${String(a.data.title ?? '')} »`;
    case 'task_done':
      return `${who} a terminé « ${String(a.data.title ?? '')} »`;
    case 'badge_awarded': {
      const b = BADGE_LABELS[a.data.badge as BadgeKind];
      return b ? `${who} a gagné le timbre « ${b.title} »` : `${who} a gagné un timbre`;
    }
    case 'role_changed':
      return `Les rôles du groupe ont changé`;
    case 'ownership_transferred':
      return `L’organisation a été transmise`;
    default:
      return `${who} a fait avancer le groupe`;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}
