import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { HeaderAction, Perforation } from './headers';
import { T } from './ui';

/** Retour : même bouton rond que les autres actions d'en-tête (HeaderAction). */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  return (
    <HeaderAction label="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}>
      <ChevronLeft size={24} color={colors.ink} strokeWidth={2.25} />
    </HeaderAction>
  );
}

/** En-tête des écrans secondaires (réglages, participer, groupe…) : retour, titre, contexte en ligne d'état. */
export function BackHeader({ title, subtitle, right, fallback }: { title: string; subtitle?: string; right?: ReactNode; fallback?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <BackButton fallback={fallback} />
        {right}
      </View>
      <T v="display" accessibilityRole="header" style={{ fontSize: 28, lineHeight: 32 }}>
        {title}
      </T>
      {subtitle ? (
        <T v="small" color={colors.inkSoft} style={{ fontFamily: fonts.bold }}>
          {subtitle}
        </T>
      ) : null}
      <Perforation accent={colors.ink} />
    </View>
  );
}
