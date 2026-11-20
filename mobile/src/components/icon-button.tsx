import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/tokens';

export function IconButton({ children, label, onPress, dot }: { children: ReactNode; label: string; onPress: () => void; dot?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      {children}
      {dot ? <View style={{ position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.coral }} /> : null}
    </Pressable>
  );
}
