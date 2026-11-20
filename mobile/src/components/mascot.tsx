import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';
import { T } from './ui';

type Mood = 'happy' | 'wink' | 'calm';

/** Mascotte COMPLICE : un cadeau-cœur corail, nœud jaune, visage complice. Décorative. */
export function Mascot({ size = 72, mood = 'happy' }: { size?: number; mood?: Mood }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Corps : cœur arrondi */}
      <Path
        d="M50 92 C30 82 10 66 10 44 C10 30 20 22 31 22 C40 22 46 27 50 33 C54 27 60 22 69 22 C80 22 90 30 90 44 C90 66 70 82 50 92 Z"
        fill={colors.coral}
      />
      {/* Reflet */}
      <Ellipse cx="28" cy="40" rx="6" ry="9" fill="#FF8A73" opacity={0.6} />
      {/* Nœud */}
      <G>
        <Path d="M50 24 C40 8 26 10 30 20 C33 27 44 26 50 24 Z" fill={colors.sun} />
        <Path d="M50 24 C60 8 74 10 70 20 C67 27 56 26 50 24 Z" fill={colors.sun} />
        <Circle cx="50" cy="24" r="5.5" fill="#F5A623" />
      </G>
      {/* Visage */}
      {mood === 'wink' ? (
        <Path d="M33 52 Q38 48 43 52" stroke={colors.ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : (
        <Ellipse cx="38" cy="51" rx="3.4" ry="4.2" fill={colors.ink} />
      )}
      <Ellipse cx="62" cy="51" rx="3.4" ry="4.2" fill={colors.ink} />
      {mood === 'calm' ? (
        <Path d="M42 64 Q50 68 58 64" stroke={colors.ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M40 61 Q50 72 60 61" stroke={colors.ink} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      )}
      <Ellipse cx="30" cy="60" rx="5" ry="3" fill="#FF8A73" opacity={0.7} />
      <Ellipse cx="70" cy="60" rx="5" ry="3" fill="#FF8A73" opacity={0.7} />
    </Svg>
    </View>
  );
}

export function Logo({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  if (size === 'sm') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Complice">
        <Mascot size={30} />
        <T v="h3" style={{ fontFamily: 'Nunito_900Black' }}>
          complice
        </T>
      </View>
    );
  }
  return (
    <View style={{ alignItems: 'center', gap: 4 }} accessibilityRole="header" accessibilityLabel="Complice">
      <Mascot size={84} />
      <T v="display" style={{ fontSize: 46, lineHeight: 50 }}>
        complice
      </T>
    </View>
  );
}
