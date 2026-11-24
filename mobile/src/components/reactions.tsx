import type { Reaction } from '@complice/shared';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';

/**
 * Réactions COMPLICE : un jeu dessiné dans l'univers de la mascotte (formes rondes, trait aubergine),
 * à la place des emojis du système. Les valeurs en base restent les emojis (proposal_reactions.emoji).
 */
export const REACTION_LABELS: Record<Reaction, string> = {
  '❤️': 'J’adore',
  '😍': 'Coup de cœur',
  '😂': 'Trop drôle',
  '🤔': 'À voir',
  '👎': 'Bof',
};

const INK = colors.ink;
const BLUSH = '#FF8A73';

function Face({ fill, children, size }: { fill: string; children: React.ReactNode; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="17" fill={fill} />
      {children}
    </Svg>
  );
}

export function ReactionGlyph({ emoji, size = 24 }: { emoji: string; size?: number }) {
  let glyph: React.ReactNode;
  switch (emoji as Reaction) {
    case '❤️':
      glyph = (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Path d="M20 35 C10 29 3 22 3 14 C3 8.5 7.2 5 12 5 C15.6 5 18.3 7 20 9.6 C21.7 7 24.4 5 28 5 C32.8 5 37 8.5 37 14 C37 22 30 29 20 35 Z" fill={colors.coral} />
          <Ellipse cx="11" cy="13" rx="3" ry="4.2" fill="#FF8A73" opacity={0.8} />
        </Svg>
      );
      break;
    case '😍':
      glyph = (
        <Face fill={colors.sun} size={size}>
          <G fill={colors.coral}>
            <Path d="M14 18.5 C11.5 17 10 15.6 10 14 C10 12.8 10.9 12 12 12 C12.8 12 13.5 12.5 14 13.2 C14.5 12.5 15.2 12 16 12 C17.1 12 18 12.8 18 14 C18 15.6 16.5 17 14 18.5 Z" />
            <Path d="M26 18.5 C23.5 17 22 15.6 22 14 C22 12.8 22.9 12 24 12 C24.8 12 25.5 12.5 26 13.2 C26.5 12.5 27.2 12 28 12 C29.1 12 30 12.8 30 14 C30 15.6 28.5 17 26 18.5 Z" />
          </G>
          <Path d="M13 24 Q20 31 27 24" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </Face>
      );
      break;
    case '😂':
      glyph = (
        <Face fill={colors.sun} size={size}>
          <Path d="M11 16 Q14 12.5 17 16" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <Path d="M23 16 Q26 12.5 29 16" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <Path d="M12 22 L28 22 Q27 31 20 31 Q13 31 12 22 Z" fill={INK} />
          <Path d="M15.5 27.5 Q20 25 24.5 27.5 Q22.5 30.5 20 30.5 Q17.5 30.5 15.5 27.5 Z" fill={colors.coral} />
          <Ellipse cx="9" cy="21" rx="2.6" ry="1.6" fill={BLUSH} opacity={0.8} />
          <Ellipse cx="31" cy="21" rx="2.6" ry="1.6" fill={BLUSH} opacity={0.8} />
        </Face>
      );
      break;
    case '🤔':
      glyph = (
        <Face fill={colors.blush} size={size}>
          <Path d="M11 12.5 L17 11" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <Ellipse cx="14.5" cy="17" rx="2" ry="2.5" fill={INK} />
          <Ellipse cx="25.5" cy="17" rx="2" ry="2.5" fill={INK} />
          <Path d="M15 26 Q20 24 25 26" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <Circle cx="31" cy="9" r="5.5" fill={colors.plum} />
          <Path d="M29.2 7.6 Q29.4 5.6 31.2 5.7 Q33 5.9 32.8 7.6 Q32.6 8.8 31.2 9.4 L31.1 10.6" stroke={colors.white} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <Circle cx="31.1" cy="12.4" r="0.9" fill={colors.white} />
        </Face>
      );
      break;
    default:
      glyph = (
        <Face fill={colors.sand} size={size}>
          <Ellipse cx="15" cy="17.5" rx="2" ry="2.4" fill={INK} />
          <Ellipse cx="27" cy="17.5" rx="2" ry="2.4" fill={INK} />
          <Path d="M14 26 L26 25" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </Face>
      );
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {glyph}
    </View>
  );
}
