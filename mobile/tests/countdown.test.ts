/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockOffset, countdownParts, remainingMs } from '../src/lib/countdown';

test('compte à rebours : corrigé de l’horloge du téléphone, jamais négatif', () => {
  const server = '2026-12-13T15:00:00.000Z';
  // Téléphone en avance de 10 min : l'écart mesuré le compense.
  const deviceAtReceipt = new Date('2026-12-13T15:10:00.000Z').getTime();
  const offset = clockOffset(server, deviceAtReceipt);
  assert.equal(offset, -10 * 60000);
  const reveal = '2026-12-13T15:29:00.000Z';
  assert.equal(remainingMs(reveal, offset, deviceAtReceipt), 29 * 60000);
  assert.equal(remainingMs(reveal, offset, deviceAtReceipt + 40 * 60000), 0, 'jamais négatif');
});

test('compte à rebours : jours/heures/minutes, puis heures/minutes/secondes sous un jour', () => {
  assert.deepEqual(countdownParts(((19 * 24 + 4) * 60 + 12) * 60000 + 5000).map((p) => p.value + p.unit), ['19jours', '04h', '12min']);
  assert.deepEqual(countdownParts(86400000 + 1000).map((p) => p.unit), ['jour', 'h', 'min']);
  assert.deepEqual(countdownParts((4 * 3600 + 5 * 60 + 9) * 1000).map((p) => p.value), ['04', '05', '09']);
  assert.deepEqual(countdownParts(0).map((p) => p.value), ['00', '00', '00']);
});
