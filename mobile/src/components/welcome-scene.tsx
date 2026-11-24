import { Lock } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';
import { Mascot } from './mascot';
import { Stamp } from './stamps';
import { T } from './ui';

/**
 * Scène d'accueil : l'expérience du cadeau commun en un regard (le groupe, la cagnotte, la capsule scellée,
 * un timbre), autour de la mascotte. Illustration originale, composée de pièces de la marque.
 * Décorative pour les lecteurs d'écran : la promesse est dite en texte juste en dessous.
 */
export function WelcomeScene({ width, height }: { width: number; height: number }) {
  const reduce = useReducedMotion();
  const enter = (i: number) => (reduce ? FadeIn.duration(150) : FadeInDown.delay(150 + i * 110).duration(380));
  // La scène remplit l'espace disponible : la mascotte et le cercle suivent le plus petit côté,
  // les étiquettes s'écartent vers les bords sur un grand écran.
  const size = Math.min(width, height / 0.92);
  const m = Math.round(Math.min(size * 0.46, height * 0.42));
  // Les étiquettes suivent la taille de la scène (petit écran : plus petites, jamais sur la mascotte).
  const k = Math.max(0.68, Math.min(1, size / 360));
  return (
    <View style={{ width, height, alignSelf: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* Fond : grand cercle papier + ruban qui traverse */}
      <Svg width={width} height={height} style={{ position: 'absolute' }} viewBox="0 0 100 92" preserveAspectRatio="xMidYMid meet">
        <Circle cx="50" cy="48" r="40" fill={colors.coralSoft} />
        <Path d="M4 70 C 26 52, 40 84, 62 66 S 92 50, 98 58" stroke={colors.sun} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        <Circle cx="14" cy="22" r="2" fill={colors.violet} />
        <Circle cx="88" cy="30" r="1.6" fill={colors.coral} />
        <Circle cx="82" cy="84" r="2.2" fill={colors.violet} opacity={0.6} />
      </Svg>
      <Animated.View entering={reduce ? FadeIn.duration(150) : FadeIn.duration(500)} style={{ position: 'absolute', left: (width - m) / 2, top: (height - m) / 2 + height * 0.02 }}>
        <Mascot size={m} mood="wink" />
      </Animated.View>

      {/* Le groupe */}
      <Animated.View entering={enter(0)} style={[tag, { left: 0, top: 0, transformOrigin: 'left top', transform: [{ scale: k }, { rotate: '-4deg' }] }]}>
        <View style={{ flexDirection: 'row' }}>
          {[colors.lavenderStrong, '#FFD6C8', colors.sunSoft].map((c, i) => (
            <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: 2, borderColor: colors.white, marginLeft: i ? -7 : 0 }} />
          ))}
        </View>
        <T v="label" maxFontSizeMultiplier={1.2}>5 complices</T>
      </Animated.View>

      {/* La cagnotte */}
      <Animated.View entering={enter(1)} style={[tag, { right: 0, top: height * 0.16, transformOrigin: 'right top', transform: [{ scale: k }, { rotate: '3deg' }], flexDirection: 'column', alignItems: 'flex-start', gap: 4, paddingVertical: 10 }]}>
        <T v="small" color={colors.inkSoft} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold }}>
          Cagnotte
        </T>
        <T v="moneySmall" color={colors.coralInk} maxFontSizeMultiplier={1.2}>
          180 € réunis
        </T>
        <View style={{ width: 96, height: 6, borderRadius: 3, backgroundColor: colors.coralSoft }}>
          <View style={{ width: '78%', height: 6, borderRadius: 3, backgroundColor: colors.coral }} />
        </View>
      </Animated.View>

      {/* La capsule */}
      <Animated.View entering={enter(2)} style={[tag, { left: width * 0.02, bottom: height * 0.08, backgroundColor: colors.night, transformOrigin: 'left bottom', transform: [{ scale: k }, { rotate: '2deg' }] }]}>
        <Lock size={15} color={colors.sun} strokeWidth={2.5} />
        <T v="label" color={colors.white} maxFontSizeMultiplier={1.2}>
          12 mots scellés
        </T>
      </Animated.View>

      {/* Un timbre */}
      <Animated.View entering={enter(3)} style={{ position: 'absolute', right: width * 0.06, bottom: height * 0.02, transform: [{ rotate: '-9deg' }] }}>
        <Stamp kind="proposer" earned size={Math.round(size * 0.17)} />
      </Animated.View>
    </View>
  );
}

const tag = {
  position: 'absolute' as const,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: space.sm,
  paddingHorizontal: space.md,
  paddingVertical: space.sm,
  borderRadius: radius.chip,
  backgroundColor: colors.white,
  ...shadow.card,
};
