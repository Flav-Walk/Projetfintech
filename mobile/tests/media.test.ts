/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64ToBytes, checkImageBytes, sniffImageType } from '../src/lib/image-bytes';
import { coverFor, COVER_ARTS } from '../src/lib/covers';

const jpeg = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n - 4, 7)]);

test('base64 : décodage identique à Node (avec préfixe data:, sans remplissage)', () => {
  for (const len of [1, 2, 3, 4, 5, 600]) {
    const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37) % 256));
    assert.deepEqual(Buffer.from(base64ToBytes(buf.toString('base64'))), buf);
    assert.deepEqual(Buffer.from(base64ToBytes(`data:image/png;base64,${buf.toString('base64').replace(/=+$/, '')}`)), buf);
  }
  assert.throws(() => base64ToBytes('@@@@'), /invalid_base64/);
});

test('image : signature réelle vérifiée ; le fichier de 14 octets du bug est refusé', () => {
  assert.equal(sniffImageType(new Uint8Array(jpeg(20))), 'image/jpeg');
  assert.equal(sniffImageType(new Uint8Array(Buffer.from('89504e470d0a1a0a0000', 'hex'))), 'image/png');
  assert.equal(sniffImageType(new Uint8Array(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))), 'image/webp');
  assert.equal(sniffImageType(new Uint8Array(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic')]))), 'image/heic');
  assert.deepEqual(checkImageBytes(new Uint8Array(Buffer.from('[object Object]').subarray(0, 14))), { ok: false, reason: 'too_small' });
  assert.deepEqual(checkImageBytes(new Uint8Array(Buffer.alloc(4096, 1))), { ok: false, reason: 'unsupported' });
  assert.deepEqual(checkImageBytes(new Uint8Array(jpeg(4096))), { ok: true, type: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(checkImageBytes(new Uint8Array(jpeg(6 * 1024 * 1024))), { ok: false, reason: 'too_large' });
});

test('couverture : photo, sinon illustration choisie, sinon illustration selon l’occasion', () => {
  assert.deepEqual(coverFor({ cover_path: 'u/covers/a.jpg', cover_art: 'mariage', occasion: 'anniversaire' }), { kind: 'photo', path: 'u/covers/a.jpg', fallback: 'mariage' });
  assert.deepEqual(coverFor({ cover_path: null, cover_art: 'soiree', occasion: 'anniversaire' }), { kind: 'art', art: 'soiree' });
  assert.deepEqual(coverFor({ cover_path: null, cover_art: null, occasion: 'départ' }), { kind: 'art', art: 'depart' });
  assert.deepEqual(coverFor({ cover_path: null, cover_art: null, occasion: 'naissance' }), { kind: 'art', art: 'autre' });
  assert.deepEqual(coverFor({ cover_path: null, cover_art: 'inconnu', occasion: 'Anniversaire' }), { kind: 'art', art: 'anniversaire' });
  assert.equal(COVER_ARTS.length, 6);
});
