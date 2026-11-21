import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Jeton d'invitation mémorisé pendant l'inscription / la connexion,
 * pour ramener l'utilisateur sur l'événement concerné ensuite.
 */
const KEY = 'complice.pendingInvite';

export async function savePendingInvite(token: string) {
  try {
    await AsyncStorage.setItem(KEY, token);
  } catch {
    // Stockage indisponible : l'utilisateur pourra rouvrir le lien.
  }
}

/** Lecture sans effacement (pour l'ajouter au lien de confirmation). */
export async function peekPendingInvite(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function takePendingInvite(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) await AsyncStorage.removeItem(KEY);
    return token;
  } catch {
    return null;
  }
}

/** Extrait un jeton depuis un lien complet, un lien profond ou le code seul. */
export function extractInviteToken(input: string): string | null {
  const match = input.trim().match(/([a-f0-9]{64})/i);
  return match ? match[1].toLowerCase() : null;
}
