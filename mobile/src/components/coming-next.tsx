import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gutter, space } from '@/theme/tokens';
import { BackButton } from './back-header';
import { Mascot } from './mascot';
import { Banner, T } from './ui';
import { View } from 'react-native';

/** Écran réservé à un lot non encore livré : l'état est dit clairement, sans fausse fonctionnalité. */
export function ComingNext({ title, lot, text, back = false }: { title: string; lot: string; text: string; back?: boolean }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: gutter, gap: space.lg }} edges={['top']}>
      {back ? <BackButton /> : null}
      <T v="h1" accessibilityRole="header">
        {title}
      </T>
      <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
        <Mascot size={110} mood="calm" />
      </View>
      <Banner tone="info" title={`Arrive au ${lot}`}>
        {text}
      </Banner>
    </SafeAreaView>
  );
}
