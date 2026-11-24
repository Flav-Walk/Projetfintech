import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { T } from './ui';

export type Mood = 'happy' | 'wink' | 'calm' | 'surprised' | 'party';

const HEART = 'M50 93 C29 83 9 67 9 44 C9 29.5 19.5 21 31 21 C40 21 46 26 50 32.5 C54 26 60 21 69 21 C80.5 21 91 29.5 91 44 C91 67 71 83 50 93 Z';

/**
 * Mascotte COMPLICE (« Cadô ») : un cadeau-cœur corail, ruban et nœud soleil, visage complice.
 * Décorative : masquée aux lecteurs d'écran. Humeurs : joie, clin d'œil, calme, surprise, fête.
 */
export function Mascot({ size = 72, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const eye = (cx: number) => (
    <G>
      <Ellipse cx={cx} cy="52" rx="4.2" ry="5.2" fill={colors.ink} />
      <Circle cx={cx + 1.4} cy="50.2" r="1.5" fill={colors.white} />
    </G>
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="heart">
            <Path d={HEART} />
          </ClipPath>
        </Defs>
        {mood === 'party' ? (
          <G>
            <Rect x="6" y="14" width="6" height="3" rx="1.5" fill={colors.coral} transform="rotate(-30 9 15)" />
            <Circle cx="92" cy="18" r="3" fill={colors.plum} />
            <Rect x="86" y="70" width="6" height="3" rx="1.5" fill={colors.sun} transform="rotate(25 89 71)" />
            <Circle cx="7" cy="72" r="2.5" fill={colors.sun} />
          </G>
        ) : null}
        <Path d={HEART} fill={colors.coral} />
        <G clipPath="url(#heart)">
          {/* Ruban vertical : le cœur est aussi un paquet cadeau. */}
          <Rect x="44" y="0" width="12" height="100" fill={colors.sun} />
          <Rect x="44" y="0" width="3" height="100" fill="#FFE08A" />
          <Ellipse cx="27" cy="38" rx="7" ry="10" fill="#FF8A73" opacity={0.55} />
        </G>
        {/* Nœud */}
        <Path d="M50 25 C40 8 24 9 28 21 C31 29 43 28 50 25 Z" fill={colors.sun} />
        <Path d="M50 25 C60 8 76 9 72 21 C69 29 57 28 50 25 Z" fill={colors.sun} />
        <Path d="M50 25 C44 17 34 15 34 20 C35 24 43 25 50 25 Z" fill="#F5A623" opacity={0.55} />
        <Path d="M50 25 C56 17 66 15 66 20 C65 24 57 25 50 25 Z" fill="#F5A623" opacity={0.55} />
        <Circle cx="50" cy="25" r="5.5" fill="#F5A623" />
        {/* Visage (posé sur le ruban, lisible) */}
        {mood === 'wink' ? <Path d="M29 52 Q34 47.5 39 52" stroke={colors.ink} strokeWidth="3.4" fill="none" strokeLinecap="round" /> : eye(34)}
        {eye(66)}
        {mood === 'calm' ? (
          <Path d="M42 66 Q50 70 58 66" stroke={colors.ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
        ) : mood === 'surprised' ? (
          <Ellipse cx="50" cy="67" rx="5" ry="6" fill={colors.ink} />
        ) : mood === 'party' ? (
          <Path d="M39 61 L61 61 Q60 74 50 74 Q40 74 39 61 Z" fill={colors.ink} />
        ) : (
          <Path d="M40 62 Q50 73 60 62" stroke={colors.ink} strokeWidth="3.6" fill="none" strokeLinecap="round" />
        )}
        <Ellipse cx="25" cy="62" rx="5.5" ry="3.2" fill="#FF8A73" opacity={0.85} />
        <Ellipse cx="75" cy="62" rx="5.5" ry="3.2" fill="#FF8A73" opacity={0.85} />
      </Svg>
    </View>
  );
}

/** Logo : mascotte + mot « complice » en Bricolage Grotesque. Version courte lisible dès 24 px. */
export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  if (size === 'sm') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Complice">
        <Mascot size={30} />
        <T v="h3" maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.6 }}>
          complice
        </T>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 2 }} accessibilityRole="header" accessibilityLabel="Complice">
      <Mascot size={96} />
      <T v="display" maxFontSizeMultiplier={1.2} style={{ fontSize: 50, lineHeight: 54, letterSpacing: -1.6 }}>
        complice
      </T>
    </View>
  );
}
