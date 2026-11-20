import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';

/** Identifiant de l'événement courant, quel que soit l'écran imbriqué. */
export function useEventId(): string {
  const local = useLocalSearchParams<{ id?: string }>();
  const global = useGlobalSearchParams<{ id?: string }>();
  return String(local.id ?? global.id ?? '');
}
