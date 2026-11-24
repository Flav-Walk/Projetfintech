/**
 * Octets d'une image choisie, vérifiés avant envoi.
 * Cause du bug des couvertures blanches (2026-11-23) : `fetch(uri).arrayBuffer()` ne renvoie pas le contenu
 * réel du fichier sur React Native ; un fichier de 14 octets était envoyé et enregistré comme couverture.
 * On lit donc l'image en base64 (fournie par expo-image-picker) et on contrôle sa signature binaire.
 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256).fill(255);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;
LOOKUP['-'.charCodeAt(0)] = 62;
LOOKUP['_'.charCodeAt(0)] = 63;

/** Décode du base64 (avec ou sans préfixe data:, avec ou sans remplissage). */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/^data:[^,]*,/, '').replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)]!;
    const b = LOOKUP[clean.charCodeAt(i + 1)]!;
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)]! : 0;
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)]! : 0;
    if (a === 255 || b === 255 || c === 255 || d === 255) throw new Error('invalid_base64');
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 0xff;
    if (o < out.length && i + 2 < clean.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length && i + 3 < clean.length) out[o++] = n & 0xff;
  }
  return out.subarray(0, o);
}

export type ImageKind = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/** Type réel d'après les premiers octets (le type annoncé par le système n'est pas fiable). */
export function sniffImageType(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b.length >= 12 && String.fromCharCode(b[4]!, b[5]!, b[6]!, b[7]!) === 'ftyp') {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
    if (/^(heic|heix|hevc|mif1|msf1)$/.test(brand)) return 'image/heic';
  }
  return null;
}

/** En dessous, ce n'est pas une vraie photo (le fichier cassé faisait 14 octets). */
export const MIN_IMAGE_BYTES = 512;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageCheck = { ok: true; type: ImageKind; ext: string } | { ok: false; reason: 'too_small' | 'too_large' | 'unsupported' };

export function checkImageBytes(b: Uint8Array): ImageCheck {
  if (b.byteLength < MIN_IMAGE_BYTES) return { ok: false, reason: 'too_small' };
  if (b.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: 'too_large' };
  const type = sniffImageType(b);
  if (!type) return { ok: false, reason: 'unsupported' };
  return { ok: true, type, ext: type === 'image/jpeg' ? 'jpg' : type.split('/')[1]! };
}

export const IMAGE_CHECK_MESSAGES: Record<'too_small' | 'too_large' | 'unsupported', string> = {
  too_small: 'Cette image n’a pas pu être lue. Choisis-en une autre.',
  too_large: 'Image trop lourde (5 Mo maximum).',
  unsupported: 'Format non pris en charge (JPEG, PNG, WebP ou HEIC).',
};
