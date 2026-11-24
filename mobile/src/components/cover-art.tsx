import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { CoverArt } from '@/lib/covers';
import { colors } from '@/theme/tokens';

/**
 * Bibliothèque de couvertures COMPLICE : six illustrations originales dessinées en SVG (aucun fichier,
 * aucune ressource externe). Cadre 16:9, recadrées en remplissage pour toute proportion.
 */
const CREAM = '#FFF8F2';

function Confetti({ seed, palette }: { seed: number; palette: string[] }) {
  const items = [];
  for (let i = 0; i < 14; i++) {
    const x = (seed * 37 + i * 53) % 320;
    const y = (seed * 17 + i * 29) % 180;
    const c = palette[i % palette.length]!;
    items.push(i % 3 === 0 ? <Circle key={i} cx={x} cy={y} r={3} fill={c} /> : <Rect key={i} x={x} y={y} width={8} height={3.5} rx={1.75} fill={c} transform={`rotate(${(i * 47) % 180} ${x + 4} ${y + 2})`} />);
  }
  return <G opacity={0.9}>{items}</G>;
}

function Art({ art }: { art: CoverArt }) {
  switch (art) {
    case 'anniversaire':
      return (
        <G>
          <Rect width={320} height={180} fill={colors.coral} />
          <Path d="M0 18 Q80 46 160 22 T320 20" stroke={CREAM} strokeWidth={2} fill="none" opacity={0.8} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const x = 14 + i * 40;
            const y = 22 + Math.sin(i * 0.9) * 8;
            return <Path key={i} d={`M${x} ${y} l14 0 l-7 18 z`} fill={[colors.sun, CREAM, colors.violet, colors.lavenderStrong][i % 4]} />;
          })}
          <Confetti seed={3} palette={[colors.sun, CREAM, colors.lavenderStrong]} />
          {/* Gâteau */}
          <Rect x={110} y={108} width={100} height={46} rx={10} fill={CREAM} />
          <Path d="M110 122 Q122 132 135 122 T160 122 T185 122 T210 122 L210 116 Q210 108 202 108 L118 108 Q110 108 110 116 Z" fill={colors.sun} />
          <Rect x={100} y={152} width={120} height={8} rx={4} fill={colors.night} opacity={0.35} />
          {[132, 158, 184].map((x) => (
            <G key={x}>
              <Rect x={x - 3} y={86} width={6} height={22} rx={3} fill={colors.lavenderStrong} />
              <Path d={`M${x} 72 Q${x + 6} 80 ${x} 86 Q${x - 6} 80 ${x} 72 Z`} fill={colors.sun} />
            </G>
          ))}
          {/* Ballons */}
          <Path d="M268 120 Q262 140 270 160" stroke={CREAM} strokeWidth={1.5} fill="none" />
          <Circle cx={268} cy={98} r={22} fill={colors.violet} />
          <Path d="M240 112 Q238 136 244 158" stroke={CREAM} strokeWidth={1.5} fill="none" />
          <Circle cx={240} cy={92} r={17} fill={colors.sun} />
        </G>
      );
    case 'soiree':
      return (
        <G>
          <Rect width={320} height={180} fill={colors.night} />
          <Path d="M0 30 Q160 80 320 26" stroke={colors.lavenderStrong} strokeWidth={1.2} fill="none" opacity={0.6} />
          {Array.from({ length: 11 }, (_, i) => {
            const t = i / 10;
            const x = t * 320;
            const y = (1 - t) * (1 - t) * 30 + 2 * (1 - t) * t * 80 + t * t * 26;
            return <Circle key={i} cx={x} cy={y + 6} r={4.5} fill={[colors.sun, colors.coral, CREAM][i % 3]} />;
          })}
          <Path d="M262 70 A26 26 0 1 0 288 108 A20 20 0 1 1 262 70 Z" fill={colors.sun} />
          {[[60, 110, 7], [110, 70, 4], [200, 120, 6], [150, 150, 3], [40, 160, 4]].map(([x, y, r], i) => (
            <Path key={i} d={`M${x} ${y! - r! * 2} L${x! + r! * 0.5} ${y! - r! * 0.5} L${x! + r! * 2} ${y} L${x! + r! * 0.5} ${y! + r! * 0.5} L${x} ${y! + r! * 2} L${x! - r! * 0.5} ${y! + r! * 0.5} L${x! - r! * 2} ${y} L${x! - r! * 0.5} ${y! - r! * 0.5} Z`} fill={i % 2 ? colors.lavenderStrong : CREAM} />
          ))}
          {/* Verres */}
          <Path d="M130 104 L150 104 L144 128 L136 128 Z" fill={colors.coral} />
          <Rect x={139} y={128} width={2.5} height={20} fill={CREAM} />
          <Path d="M162 100 L182 100 L176 124 L168 124 Z" fill={colors.sun} />
          <Rect x={171} y={124} width={2.5} height={24} fill={CREAM} />
        </G>
      );
    case 'depart':
      return (
        <G>
          <Rect width={320} height={180} fill={colors.violet} />
          <Path d="M30 150 Q120 140 170 96 T290 40" stroke={CREAM} strokeWidth={2.5} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
          <G transform="translate(262 22) rotate(-18)">
            <Path d="M0 18 L46 0 L30 40 L22 26 Z" fill={CREAM} />
            <Path d="M22 26 L46 0 L16 22 Z" fill={colors.lavenderStrong} />
          </G>
          {[[60, 52], [180, 140]].map(([x, y], i) => (
            <Path key={i} d={`M${x} ${y} q8 -16 24 -8 q8 -14 24 -2 q14 0 14 14 q0 12 -14 12 h-46 q-14 0 -14 -12 q0 -8 12 -4z`} fill={CREAM} opacity={0.22} />
          ))}
          {/* Valise */}
          <Rect x={56} y={104} width={68} height={50} rx={10} fill={colors.coral} />
          <Rect x={76} y={94} width={28} height={12} rx={6} fill="none" stroke={colors.coral} strokeWidth={5} />
          <Rect x={56} y={122} width={68} height={6} fill={colors.sun} />
          <Circle cx={68} cy={158} r={4} fill={colors.night} />
          <Circle cx={112} cy={158} r={4} fill={colors.night} />
        </G>
      );
    case 'mariage':
      return (
        <G>
          <Rect width={320} height={180} fill={colors.coralSoft} />
          <Confetti seed={9} palette={[colors.coral, colors.sun, colors.lavenderStrong]} />
          <Circle cx={142} cy={98} r={34} fill="none" stroke={colors.sun} strokeWidth={9} />
          <Circle cx={182} cy={98} r={34} fill="none" stroke={colors.coral} strokeWidth={9} />
          <Path d="M168 60 l6 -10 l6 10 l-6 6 z" fill={colors.lavenderStrong} />
          {[[54, 140, -30], [266, 46, 150]].map(([x, y, r], i) => (
            <G key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
              <Path d="M0 0 C10 -26 34 -30 44 -18" stroke={colors.success} strokeWidth={2.5} fill="none" />
              <Path d="M14 -12 q2 -14 14 -14 q-2 12 -14 14z M26 -20 q6 -12 18 -8 q-6 10 -18 8z" fill={colors.success} opacity={0.8} />
            </G>
          ))}
          <Path d="M250 128 c-6 -10 -20 -4 -14 6 l14 12 l14 -12 c6 -10 -8 -16 -14 -6z" fill={colors.coral} />
        </G>
      );
    case 'amis':
      return (
        <G>
          <Rect width={320} height={180} fill={colors.sun} />
          <Circle cx={60} cy={30} r={46} fill={CREAM} opacity={0.35} />
          {[
            [110, 112, colors.coral],
            [160, 98, colors.violet],
            [210, 112, colors.night],
          ].map(([x, y, c], i) => (
            <G key={i}>
              <Path d={`M${x! as number - 30} ${180} q0 -46 30 -46 q30 0 30 46z`} fill={c as string} />
              <Circle cx={x as number} cy={y as number} r={20} fill={c as string} />
              <Circle cx={(x as number) - 6} cy={(y as number) - 2} r={2.6} fill={CREAM} />
              <Circle cx={(x as number) + 6} cy={(y as number) - 2} r={2.6} fill={CREAM} />
              <Path d={`M${(x as number) - 7} ${(y as number) + 7} q7 6 14 0`} stroke={CREAM} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            </G>
          ))}
          <Path d="M232 34 h60 q10 0 10 10 v22 q0 10 -10 10 h-34 l-12 12 v-12 h-14 q-10 0 -10 -10 v-22 q0 -10 10 -10z" fill={CREAM} />
          <Path d="M262 52 c-3 -6 -12 -3 -8 4 l8 7 l8 -7 c4 -7 -5 -10 -8 -4z" fill={colors.coral} />
        </G>
      );
    default:
      return (
        <G>
          <Rect width={320} height={180} fill={colors.lavender} />
          <Confetti seed={5} palette={[colors.violet, colors.coral, colors.sun]} />
          <Rect x={116} y={78} width={88} height={74} rx={8} fill={colors.coral} />
          <Rect x={108} y={64} width={104} height={22} rx={6} fill={colors.coralDark} />
          <Rect x={153} y={64} width={14} height={88} fill={colors.sun} />
          <Path d="M160 64 C140 36 116 44 126 58 C132 66 148 66 160 64 Z M160 64 C180 36 204 44 194 58 C188 66 172 66 160 64 Z" fill={colors.sun} />
          <Circle cx={160} cy={64} r={6} fill="#F5A623" />
        </G>
      );
  }
}

export function CoverArtView({ art, style }: { art: CoverArt; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ overflow: 'hidden' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <Art art={art} />
      </Svg>
    </View>
  );
}
