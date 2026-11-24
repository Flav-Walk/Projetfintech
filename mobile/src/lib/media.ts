import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { base64ToBytes, checkImageBytes, IMAGE_CHECK_MESSAGES } from './image-bytes';
import { supabase } from './supabase';

export type PickedImage = { uri: string; mimeType: string; size: number | null; base64: string | null };

/** Sélection d'une image dans la galerie, recadrée et compressée. Renvoie null si annulé. */
export async function pickImage(aspect: [number, number] = [4, 3]): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.75, base64: true });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null, base64: a.base64 ?? null };
}

/** Octets réels de l'image : base64 du sélecteur, sinon lecture du fichier (web : blob ou data:). */
async function readBytes(img: PickedImage): Promise<Uint8Array> {
  if (img.base64) return base64ToBytes(img.base64);
  if (img.uri.startsWith('data:')) return base64ToBytes(img.uri);
  const res = await fetch(img.uri);
  return new Uint8Array(await (await res.blob()).arrayBuffer());
}

/**
 * Dépôt dans un bucket privé. Le chemin est imposé par les politiques Storage
 * (voir supabase/migrations/…_storage_realtime.sql). Type et taille vérifiés ici sur les octets réels,
 * puis revérifiés par le bucket (types autorisés, taille maximale).
 */
export async function uploadImage(bucket: 'avatars' | 'event-media', folder: string, img: PickedImage): Promise<string> {
  const bytes = await readBytes(img);
  const check = checkImageBytes(bytes);
  if (!check.ok) throw new Error(IMAGE_CHECK_MESSAGES[check.reason]);
  const path = `${folder}/${Crypto.randomUUID()}.${check.ext}`;
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: check.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** URL signée courte (10 min) : aucun fichier privé n'a d'URL publique permanente. */
export async function signedUrl(bucket: 'avatars' | 'event-media', path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
