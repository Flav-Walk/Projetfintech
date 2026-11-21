import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountToCents, formatCents, progressPercent, validateContribution } from './money.js';
import { errorCodeFrom } from './errors.js';
import { fundingStepLabel } from './domain.js';

test('parseAmountToCents', () => {
  assert.equal(parseAmountToCents('15'), 1500);
  assert.equal(parseAmountToCents('15,5'), 1550);
  assert.equal(parseAmountToCents('15.05'), 1505);
  assert.equal(parseAmountToCents('1 200,00 €'), 120000);
  assert.equal(parseAmountToCents('0,1'), 10);
  assert.equal(parseAmountToCents('15,555'), null);
  assert.equal(parseAmountToCents('-5'), null);
  assert.equal(parseAmountToCents('abc'), null);
  assert.equal(parseAmountToCents(''), null);
});

test('formatCents (fr-FR)', () => {
  assert.match(formatCents(13500), /^135\s€$/);
  assert.match(formatCents(1550), /^15,50\s€$/);
  assert.match(formatCents(120000), /^1\s200\s€$/);
});

test('progressPercent : valeurs de la planche corrigées', () => {
  assert.equal(progressPercent(13500, 18000), 75);
  assert.equal(progressPercent(15000, 18000), 83);
  assert.equal(progressPercent(25000, 18000), 100);
  assert.equal(progressPercent(0, 0), 0);
});

test('validateContribution', () => {
  assert.deepEqual(validateContribution('15'), { ok: true, cents: 1500 });
  assert.deepEqual(validateContribution('0,50'), { ok: false, reason: 'too_small' });
  assert.deepEqual(validateContribution('1001'), { ok: false, reason: 'too_large' });
  assert.deepEqual(validateContribution('x'), { ok: false, reason: 'format' });
});

test('fundingStepLabel : paliers, jamais de montant', () => {
  assert.equal(fundingStepLabel(0, false), 'La cagnotte démarre');
  assert.equal(fundingStepLabel(50, false), 'Plus de la moitié de l’objectif');
  assert.equal(fundingStepLabel(100, true), 'Objectif atteint');
  assert.doesNotMatch(fundingStepLabel(75, false), /€|\d/);
});

test('errorCodeFrom', () => {
  assert.equal(errorCodeFrom({ message: 'invalid_target_amount' }), 'invalid_target_amount');
  assert.equal(errorCodeFrom({ message: 'invalid_target' }), 'invalid_target');
  assert.equal(errorCodeFrom({ message: 'votes_closed' }), 'votes_closed');
  assert.equal(errorCodeFrom(new Error('new row violates row-level security policy')), 'forbidden');
  assert.equal(errorCodeFrom(new TypeError('Network request failed')), 'network');
  assert.equal(errorCodeFrom({ message: 'weird' }), 'unknown');
  assert.equal(errorCodeFrom({ message: 'Could not find the function public.preview_invitation(p_token) in the schema cache' }), 'service_unavailable');
});
