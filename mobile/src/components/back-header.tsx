import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { T } from './ui';

export function BackButton({ fallback = '/' }: { fallback?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      hitSlop={12}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}
    >
      <ChevronLeft size={24} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

export function BackHeader({ title, subtitle, right, fallback }: { title: string; subtitle?: string; right?: ReactNode; fallback?: string }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton fallback={fallback} />
        {right}
      </View>
      <T v="h1" accessibilityRole="header">
        {title}
      </T>
      {subtitle ? <T color={colors.inkSoft}>{subtitle}</T> : null}
    </View>
  );
}
