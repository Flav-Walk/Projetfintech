import { BADGE_LABELS, type BadgeKind } from '@complice/shared';
import { Coins, Crown, HandHeart, Lightbulb, PenLine, Vote, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { colors, fonts, space } from '@/theme/tokens';
import { T } from './ui';

/** Couleurs pastel des timbres. Corail réservé à « Complice » (participation à la cagnotte). */
const STAMP: Record<BadgeKind, { bg: string; fg: string; Icon: LucideIcon }> = {
  proposer: { bg: colors.sunSoft, fg: '#8A5A00', Icon: Lightbulb },
  voter: { bg: colors.lavender, fg: colors.violetDark, Icon: Vote },
  helper: { bg: colors.mint, fg: colors.success, Icon: HandHeart },
  wordsmith: { bg: '#FFE1EC', fg: '#A3285F', Icon: PenLine },
  contributor: { bg: colors.coralSoft, fg: colors.coralDark, Icon: Coins },
  host: { bg: '#D6ECFF', fg: '#1F5FA8', Icon: Crown },
};

export const STAMP_ORDER: BadgeKind[] = ['proposer', 'voter', 'helper', 'wordsmith', 'contributor'];

/**
 * Timbre dentelé : bord perforé dessiné en SVG, pictogramme au centre.
 * Gagné = couleur ; à gagner = gris pointillé (la condition est lisible à côté).
 */
export function Stamp({ kind, earned, size = 64 }: { kind: BadgeKind; earned: boolean; size?: number }) {
  const s = STAMP[kind];
  const holes = 6;
  const r = size * 0.045;
  const step = size / holes;
  const dots: { cx: number; cy: number }[] = [];
  for (let i = 0; i <= holes; i++) {
    const p = i * step;
    dots.push({ cx: p, cy: 0 }, { cx: p, cy: size }, { cx: 0, cy: p }, { cx: size, cy: p });
  }
  const inset = size * 0.13;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={earned ? colors.white : '#F6F2F4'} />
        {dots.map((d, i) => (
          <Circle key={i} cx={d.cx} cy={d.cy} r={r} fill={colors.bg} />
        ))}
        <Rect
          x={inset}
          y={inset}
          width={size - inset * 2}
          height={size - inset * 2}
          rx={size * 0.06}
          fill={earned ? s.bg : 'transparent'}
          stroke={earned ? 'transparent' : colors.inkFaint}
          strokeWidth={1.5}
          strokeDasharray={earned ? undefined : '4 3'}
        />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <s.Icon size={size * 0.38} color={earned ? s.fg : colors.inkFaint} strokeWidth={1.75} />
      </View>
    </View>
  );
}

/** Étagère de timbres d'un membre : chaque forme d'aide compte, sans lien avec un montant. */
export function StampShelf({ earned, compact = false }: { earned: Set<BadgeKind>; compact?: boolean }) {
  const size = compact ? 44 : 60;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: compact ? space.xs : space.md }}>
      {STAMP_ORDER.map((k) => {
        const has = earned.has(k);
        return (
          <View
            key={k}
            accessible
            accessibilityLabel={`Timbre ${BADGE_LABELS[k].title} : ${has ? 'gagné' : `à gagner, ${BADGE_LABELS[k].hint.toLowerCase()}`}`}
            style={{ alignItems: 'center', width: compact ? size : size + 14, gap: 4 }}
          >
            <Stamp kind={k} earned={has} size={size} />
            {compact ? null : (
              <T v="small" color={has ? colors.ink : colors.inkSoft} style={{ fontSize: 12, fontFamily: has ? fonts.bold : fonts.semiBold, textAlign: 'center' }} numberOfLines={2}>
                {has ? BADGE_LABELS[k].title : BADGE_LABELS[k].hint}
              </T>
            )}
          </View>
        );
      })}
    </View>
  );
}
