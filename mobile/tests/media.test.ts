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

test('métadonnées : GPS, appareil et commentaires retirés (JPEG, PNG), image intacte', async () => {
  const { stripImageMetadata, sniffImageType } = await import('../src/lib/image-bytes');
  const seg = (marker: number, payload: string) => { const p = Buffer.from(payload, 'latin1'); return Buffer.concat([Buffer.from([0xff, marker, (p.length + 2) >> 8, (p.length + 2) & 0xff]), p]); };
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, 'JFIF\0\x01\x01'),
    seg(0xe1, 'Exif\0\0GPSLatitude=48.85;Make=TéléphoneX'),
    seg(0xe2, 'ICC_PROFILE\0profil'),
    seg(0xfe, 'commentaire privé'),
    seg(0xed, 'Photoshop 3.0 IPTC auteur'),
    Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02]), Buffer.alloc(600, 0x55), Buffer.from([0xff, 0xd9]),
  ]);
  const out = Buffer.from(stripImageMetadata(new Uint8Array(jpeg)));
  const s = out.toString('latin1');
  assert.equal(sniffImageType(out), 'image/jpeg');
  for (const leak of ['GPSLatitude', 'Make=', 'commentaire', 'IPTC']) assert.ok(!s.includes(leak), leak);
  assert.ok(s.includes('JFIF') && s.includes('ICC_PROFILE'), 'en-têtes utiles conservés');
  assert.ok(out.subarray(out.length - 608).equals(jpeg.subarray(jpeg.length - 608)), 'données d’image inchangées');

  const chunk = (name: string, data: string) => { const d = Buffer.from(data, 'latin1'); const len = Buffer.alloc(4); len.writeUInt32BE(d.length); return Buffer.concat([len, Buffer.from(name), d, Buffer.alloc(4)]); };
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', 'x'.repeat(13)), chunk('tEXt', 'GPS\0 48.85'), chunk('eXIf', 'MM\0*'), chunk('IDAT', 'y'.repeat(600)), chunk('IEND', '')]);
  const p = Buffer.from(stripImageMetadata(new Uint8Array(png))).toString('latin1');
  assert.ok(!p.includes('GPS') && !p.includes('eXIf') && p.includes('IDAT') && p.includes('IEND'));
  // Structure inattendue : rendue telle quelle plutôt que corrompue.
  const broken = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 0x01]);
  assert.ok(Buffer.from(stripImageMetadata(new Uint8Array(broken))).equals(broken));
});
