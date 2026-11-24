import { BADGE_LABELS, type BadgeKind } from '@complice/shared';
import { Coins, Crown, HandHeart, Lightbulb, PenLine, Vote, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
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

/**
 * Timbres affichés : uniquement des gestes d'organisation (idée, vote, mission, mot).
 * Le timbre « Complice » (participation) existe en base mais n'est jamais montré : un timbre « à gagner »
 * en payant serait une pression financière, contraire à la règle du produit (docs/GAMIFICATION.md).
 */
export const STAMP_ORDER: BadgeKind[] = ['proposer', 'voter', 'helper', 'wordsmith'];

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

/** Ce que récompense chaque timbre (affiché au toucher, jamais tronqué). */
const STAMP_DETAIL: Partial<Record<BadgeKind, string>> = {
  proposer: 'proposer une idée de cadeau',
  voter: 'voter pour une idée',
  helper: 'terminer une mission',
  wordsmith: 'déposer un mot dans la capsule',
};

/**
 * Étagère de timbres : nom court toujours lisible (Idée, Voix, Coup de main, Plume) ; toucher un timbre
 * affiche ce qu'il récompense. Chaque forme d'aide compte, sans lien avec un montant.
 */
export function StampShelf({ earned, compact = false }: { earned: Set<BadgeKind>; compact?: boolean }) {
  const size = compact ? 40 : 56;
  const [focus, setFocus] = useState<BadgeKind | null>(null);
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: compact ? 'flex-start' : 'space-between', gap: compact ? space.xs : space.sm }}>
        {STAMP_ORDER.map((k) => {
          const has = earned.has(k);
          const detail = STAMP_DETAIL[k] ?? BADGE_LABELS[k].hint.toLowerCase();
          return (
            <Pressable
              key={k}
              disabled={compact}
              onPress={() => setFocus((f) => (f === k ? null : k))}
              accessibilityRole={compact ? undefined : 'button'}
              accessibilityLabel={`Timbre ${BADGE_LABELS[k].title} : ${has ? 'gagné' : 'à gagner'}, en ${detail}`}
              hitSlop={4}
              style={{ alignItems: 'center', minWidth: compact ? size : 64, gap: 6, transform: [{ rotate: has ? (k === 'voter' || k === 'wordsmith' ? '3deg' : '-3deg') : '0deg' }] }}
            >
              <Stamp kind={k} earned={has} size={size} />
              {compact ? null : (
                <T v="small" color={has ? colors.ink : colors.inkFaint} maxFontSizeMultiplier={1.3} style={{ fontFamily: has ? fonts.bold : fonts.semiBold, textAlign: 'center' }} numberOfLines={1}>
                  {BADGE_LABELS[k].title}
                </T>
              )}
            </Pressable>
          );
        })}
      </View>
      {!compact && focus ? (
        <T v="small" color={colors.inkSoft} accessibilityLiveRegion="polite">
          <T v="small" style={{ fontFamily: fonts.bold }}>{BADGE_LABELS[focus].title}</T>
          {earned.has(focus) ? ' · gagné en ' : ' · à gagner en '}
          {STAMP_DETAIL[focus] ?? BADGE_LABELS[focus].hint.toLowerCase()}.
        </T>
      ) : null}
    </View>
  );
}
