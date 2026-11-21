import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Brouillons locaux (texte seulement) : évitent de perdre un mot de capsule ou une idée en cours de saisie
 * lors d'une navigation accidentelle ou d'une fermeture de l'app.
 * Stockés sur ce téléphone uniquement (AsyncStorage), par utilisateur et par écran ; supprimés après
 * enregistrement réussi et à la déconnexion. Les photos ne sont pas conservées.
 */
const PREFIX = 'complice.draft.';

export function draftKey(userId: string | undefined, scope: string): string | null {
  return userId ? `${PREFIX}${userId}.${scope}` : null;
}

export function useLocalDraft<T extends object>(key: string | null, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const [hadDraft, setHadDraft] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    if (!key) return;
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setValue({ ...initial, ...(JSON.parse(raw) as T) });
            setHadDraft(true);
          } catch {
            // brouillon illisible : ignoré
          }
        }
      })
      .catch(() => undefined)
      .finally(() => alive && setRestored(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setValue((prev) => {
        const next = { ...prev, ...patch };
        if (key) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
          }, 400);
        }
        return next;
      });
    },
    [key],
  );

  const clear = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    setHadDraft(false);
    if (key) await AsyncStorage.removeItem(key).catch(() => undefined);
  }, [key]);

  return { value, update, clear, restored, hadDraft };
}

/** À la déconnexion : aucun brouillon ni invitation en attente ne reste sur le téléphone. */
export async function clearLocalUserData() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(PREFIX) || k === 'complice.pendingInvite');
    if (mine.length) await AsyncStorage.multiRemove(mine);
  } catch {
    // stockage indisponible : rien à effacer
  }
}
