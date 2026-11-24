/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EventProgress } from '@complice/shared';
import { buildJournal, journalText } from '../src/lib/journal';
import { buildTracks } from '../src/lib/preparation';
import type { ActivityRow } from '../src/lib/types';

let n = 0;
const row = (kind: string, minutesAgo: number, extra: Partial<ActivityRow> = {}): ActivityRow => ({
  id: ++n,
  event_id: 'e',
  actor_id: null,
  kind,
  data: {},
  created_at: new Date(Date.UTC(2026, 10, 24, 12, 0) - minutesAgo * 60000).toISOString(),
  profiles: null,
  ...extra,
});

test('journal : participations regroupées, formulées naturellement et toujours anonymes', () => {
  const rows = [row('contribution_confirmed', 1), row('contribution_confirmed', 20), row('contribution_confirmed', 50)];
  const j = buildJournal(rows);
  assert.equal(j.length, 1);
  assert.equal(j[0]!.text, '3 nouvelles participations ont été enregistrées.');
  assert.equal(j[0]!.family, 'money');
  assert.equal(journalText(rows[0]!), 'Une nouvelle participation a été enregistrée.');
  // Même si une ligne portait un profil (donnée inattendue), le texte ne le reprend jamais.
  const leaked = row('contribution_confirmed', 2, { actor_id: 'u1', profiles: { display_name: 'Hugo' } });
  assert.doesNotMatch(journalText(leaked), /Hugo/);
  assert.doesNotMatch(buildJournal([leaked, row('contribution_confirmed', 3)])[0]!.text, /Hugo/);
});

test('journal : arrivées groupées par noms, coupure au-delà de 3 h ou entre types différents', () => {
  const who = (name: string, id: string) => ({ actor_id: id, profiles: { display_name: name } });
  const j = buildJournal([
    row('member_joined', 5, who('Hugo', 'h')),
    row('member_joined', 30, who('Nora', 'n')),
    row('proposal_added', 40, { ...who('Léa', 'l'), data: { title: 'Vélo' } }),
    row('member_joined', 60, who('Sam', 's')),
    row('member_joined', 400, who('Zoé', 'z')),
  ]);
  assert.deepEqual(
    j.map((e) => e.text),
    ['Hugo et Nora ont rejoint le groupe.', 'Léa a proposé « Vélo ».', 'Sam a rejoint le groupe.', 'Zoé a rejoint le groupe.'],
  );
});

const progress = (o: Partial<EventProgress>): EventProgress => ({
  steps: [
    { key: 'group', done: false },
    { key: 'vote', done: false },
    { key: 'purchase', done: false },
    { key: 'capsule', done: false },
    { key: 'reveal', done: false },
  ],
  steps_done: 0,
  tasks_done: 0,
  tasks_total: 5,
  tasks_open: 5,
  proposals: 0,
  my_proposals: 0,
  capsule_published: 0,
  preparers: 1,
  my_capsule: 'none',
  voted: false,
  next_action: 'invite',
  my_role: 'organizer',
  votes_open: true,
  contributions_open: true,
  revealed: false,
  ...o,
});

test('préparatifs : « 0/5 » ne présente aucune étape comme faite ; la prochaine action est « à toi »', () => {
  const t = buildTracks(progress({}));
  assert.equal(t.filter((x) => x.state === 'done').length, 0);
  assert.deepEqual(
    t.map((x) => [x.key, x.state, x.mine]),
    [
      ['group', 'active', true],
      ['gift', 'todo', false],
      ['missions', 'todo', false],
      ['capsule', 'todo', false],
    ],
  );
});

test('préparatifs : chantiers parallèles, états tirés des vraies données', () => {
  const t = buildTracks(
    progress({
      steps: [
        { key: 'group', done: true },
        { key: 'vote', done: false },
        { key: 'purchase', done: false },
        { key: 'capsule', done: true },
        { key: 'reveal', done: false },
      ],
      preparers: 3,
      proposals: 2,
      tasks_done: 1,
      capsule_published: 2,
      next_action: 'vote',
    }),
  );
  const by = Object.fromEntries(t.map((x) => [x.key, x]));
  assert.equal(by.group!.state, 'done');
  assert.equal(by.gift!.state, 'active');
  assert.equal(by.gift!.status, 'Vote en cours · 2 idées');
  assert.equal(by.gift!.mine, true);
  assert.equal(by.missions!.status, '1 faite sur 5');
  // La capsule peut être bouclée avant le cadeau : aucun ordre imposé.
  assert.equal(by.capsule!.state, 'done');
});
