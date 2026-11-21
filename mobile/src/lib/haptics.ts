import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Retours haptiques discrets pour confirmer une action réussie (vote, mission prise, mot scellé,
 * lien copié). Jamais pour pousser à agir. Silencieux sur le web et si l'appareil ne les gère pas.
 */
export function hapticSuccess() {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticTap() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => undefined);
}
