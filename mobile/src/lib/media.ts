import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export type PickedImage = { uri: string; mimeType: string; size: number | null };

/** Sélection d'une image dans la galerie, recadrée et compressée. Renvoie null si annulé. */
export async function pickImage(aspect: [number, number] = [4, 3]): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect, quality: 0.7 });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null };
}

/**
 * Dépôt dans un bucket privé. Le chemin est imposé par les politiques Storage
 * (voir supabase/migrations/…_storage_realtime.sql). Taille et type revérifiés côté serveur.
 */
export async function uploadImage(bucket: 'avatars' | 'event-media', folder: string, img: PickedImage): Promise<string> {
  if (!ALLOWED.includes(img.mimeType)) throw new Error('Format non pris en charge (JPEG, PNG, WebP ou HEIC).');
  const body = await (await fetch(img.uri)).arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new Error('Image trop lourde (5 Mo maximum).');
  const ext = img.mimeType.split('/')[1]!.replace('jpeg', 'jpg');
  const path = `${folder}/${Crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: img.mimeType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** URL signée courte (10 min) : aucun fichier privé n'a d'URL publique permanente. */
export async function signedUrl(bucket: 'avatars' | 'event-media', path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
