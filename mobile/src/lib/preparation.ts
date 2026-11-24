import type { EventProgress, NextAction } from '@complice/shared';

/**
 * Les préparatifs d'une surprise : quatre chantiers qui avancent en parallèle (pas d'ordre imposé).
 * Chaque chantier a un état réel tiré de la base (event_progress) :
 * - done : l'étape SQL correspondante est validée ;
 * - active : quelque chose a commencé sans être fini ;
 * - todo : rien n'a commencé.
 * « mine » marque le chantier de la prochaine action du membre. Aucun montant ici.
 */
export type TrackKey = 'group' | 'gift' | 'missions' | 'capsule';
export type TrackState = 'done' | 'active' | 'todo';
export type Track = { key: TrackKey; title: string; status: string; state: TrackState; route: string; ratio?: number; mine: boolean };

const MINE: Partial<Record<NextAction, TrackKey>> = {
  invite: 'group',
  propose: 'gift',
  vote: 'gift',
  select_gift: 'gift',
  finish_task: 'missions',
  claim_task: 'missions',
  write_capsule: 'capsule',
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function buildTracks(p: EventProgress): Track[] {
  const done = (k: string) => p.steps.find((s) => s.key === k)?.done ?? false;
  const mine = MINE[p.next_action];
  const tracks: Omit<Track, 'mine'>[] = [
    {
      key: 'group',
      title: 'Le groupe',
      route: 'members',
      state: done('group') ? 'done' : 'active',
      status: done('group') ? plural(p.preparers, 'complice réuni', 'complices réunis') : 'Invite au moins une personne',
    },
    {
      key: 'gift',
      title: 'Le cadeau',
      route: 'ideas',
      state: done('vote') ? 'done' : p.proposals > 0 || !p.votes_open ? 'active' : 'todo',
      status: done('vote')
        ? 'Choisi par le groupe'
        : p.votes_open
          ? p.proposals === 0
            ? 'Aucune idée pour l’instant'
            : `Vote en cours · ${plural(p.proposals, 'idée', 'idées')}`
          : 'Vote clos · choix à confirmer',
    },
    {
      key: 'missions',
      title: 'Achat et missions',
      route: 'missions',
      state: done('purchase') ? 'done' : p.tasks_done > 0 ? 'active' : 'todo',
      status: p.tasks_total === 0 ? 'Aucune mission pour l’instant' : `${done('purchase') ? 'Cadeau commandé · ' : ''}${p.tasks_done} faite${p.tasks_done > 1 ? 's' : ''} sur ${p.tasks_total}`,
      ratio: p.tasks_total ? p.tasks_done / p.tasks_total : undefined,
    },
    {
      key: 'capsule',
      title: 'La capsule',
      route: 'capsule',
      state: done('capsule') ? 'done' : p.capsule_published > 0 ? 'active' : 'todo',
      status: `${plural(p.capsule_published, 'mot déposé', 'mots déposés')} sur ${p.preparers}`,
      ratio: p.preparers ? Math.min(1, p.capsule_published / p.preparers) : undefined,
    },
  ];
  return tracks.map((t) => ({ ...t, mine: t.key === mine && t.state !== 'done' }));
}
