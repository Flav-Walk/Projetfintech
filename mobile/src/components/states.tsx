import { messageFor } from '@complice/shared';
import { WifiOff } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { Mascot } from './mascot';
import { Button, T } from './ui';

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl, gap: space.md }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.coral} size="large" />
      <T color={colors.inkSoft}>{label}</T>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = messageFor(error);
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.md }} accessibilityRole="alert">
      <WifiOff color={colors.inkSoft} size={36} strokeWidth={1.75} />
      <T v="h3" style={{ textAlign: 'center' }}>
        Oups, ça n’a pas marché
      </T>
      <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
        {message}
      </T>
      {onRetry ? <Button label="Réessayer" variant="outline" onPress={onRetry} compact /> : null}
    </View>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.md }}>
      <Mascot size={88} mood="calm" />
      <T v="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T color={colors.inkSoft} style={{ textAlign: 'center' }}>
        {text}
      </T>
      {action}
    </View>
  );
}
