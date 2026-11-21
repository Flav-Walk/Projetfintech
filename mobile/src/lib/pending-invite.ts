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

/** Effacée seulement après adhésion réussie, pour permettre une reprise après erreur réseau. */
export async function clearPendingInvite(expected: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token === expected) await AsyncStorage.removeItem(KEY);
  } catch {
    // Une reprise affichera simplement « déjà membre ».
  }
}

/** Extrait un jeton depuis un lien complet, un lien profond ou le code seul. */
export function extractInviteToken(input: string): string | null {
  const match = input.trim().match(/([a-f0-9]{64})/i);
  return match ? match[1].toLowerCase() : null;
}
