import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { colors } from '@/theme/tokens';

/**
 * La capsule de la personne fêtée : une enveloppe de papier, ficelée d'un ruban corail, fermée par un sceau
 * dont le verrou est dessiné dans la cire. Chaque élément est un calque animé indépendamment :
 * - attente : la capsule respire doucement (rien si « Réduire les animations ») ;
 * - toucher quand elle est fermée : elle frémit et le verrou tressaute ;
 * - prête : le verrou s'ouvre et un halo soleil pulse sous le sceau ;
 * - ouverture : le sceau se détache, le ruban se dénoue, le rabat se lève et des confettis de papier
 *   s'échappent ; l'enveloppe s'efface pour laisser place aux mots. Transform et opacité seulement.
 */
const W = 280;
const H = 220;
const CX = 140;
const CY = 130;
const PAPER = '#FFF8F2';
const PAPER_EDGE = '#E9DCCE';
const WAX = colors.coralDark;
const WAX_DARK = '#9E2A16';

export type SealedCapsuleHandle = { wiggle: () => void; open: (onDone: () => void) => void; finish: () => void };

type Props = { width: number; state: 'sealed' | 'ready'; reduce: boolean };

const Layer = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, style]}>
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      {children}
    </Svg>
  </Animated.View>
);

/** Bord festonné de la cire (16 lobes). */
function scallop(r: number, cx = CX, cy = CY) {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rr = r + Math.sin(a * 16) * 2.2;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const PIECES = [
  { a: -150, d: 120, c: colors.sun, s: 'r' },
  { a: -120, d: 135, c: colors.coral, s: 'c' },
  { a: -95, d: 110, c: colors.blush, s: 'r' },
  { a: -70, d: 140, c: colors.sun, s: 'c' },
  { a: -40, d: 118, c: colors.coral, s: 'r' },
  { a: -15, d: 128, c: colors.plum, s: 'c' },
  { a: -165, d: 100, c: colors.plum, s: 'r' },
  { a: 10, d: 96, c: colors.sun, s: 'r' },
  { a: -190, d: 92, c: colors.blush, s: 'c' },
] as const;

function Piece({ p, o, k }: { p: (typeof PIECES)[number]; o: SharedValue<number>; k: number }) {
  const style = useAnimatedStyle(() => {
    const t = interpolate(o.value, [0.28, 0.85], [0, 1], 'clamp');
    const rad = (p.a * Math.PI) / 180;
    return {
      opacity: interpolate(t, [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
      transform: [{ translateX: Math.cos(rad) * p.d * t * k }, { translateY: (Math.sin(rad) * p.d * t + 40 * t * t) * k }, { rotate: `${t * 220}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: CX * k - 5, top: CY * k - 5, width: 10, height: 10, borderRadius: p.s === 'c' ? 5 : 2, backgroundColor: p.c }, style]} />
  );
}

/** Une moitié de ruban qui glisse hors de l'enveloppe. */
function useRibbon(o: SharedValue<number>, dx: number, dy: number, k: number) {
  return useAnimatedStyle(() => {
    const t = interpolate(o.value, [0.3, 0.62], [0, 1], 'clamp');
    return { opacity: 1 - t, transform: [{ translateX: dx * t * k }, { translateY: dy * t * k }] };
  });
}

export const SealedCapsule = forwardRef<SealedCapsuleHandle, Props>(function SealedCapsule({ width, state, reduce }, ref) {
  const k = width / W;
  const bob = useSharedValue(0);
  const tilt = useSharedValue(0);
  const shake = useSharedValue(0);
  const unlock = useSharedValue(state === 'ready' ? 1 : 0);
  const halo = useSharedValue(0);
  const o = useSharedValue(0);

  // Attente : respiration lente (2,8 s), arrêtée si les animations sont réduites.
  useEffect(() => {
    if (reduce) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(bob);
  }, [reduce, bob]);

  // Passage à « prête » : le verrou s'ouvre, puis un halo pulse doucement.
  useEffect(() => {
    if (state !== 'ready') {
      unlock.value = 0;
      cancelAnimation(halo);
      halo.value = 0;
      return;
    }
    unlock.value = reduce ? 1 : withDelay(250, withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.4)) }));
    halo.value = reduce ? 0.6 : withDelay(500, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
    return () => cancelAnimation(halo);
  }, [state, reduce, unlock, halo]);

  useImperativeHandle(ref, () => ({
    wiggle: () => {
      if (reduce) return;
      tilt.value = withSequence(withTiming(-3.5, { duration: 70 }), withTiming(3.5, { duration: 90 }), withTiming(-2, { duration: 80 }), withTiming(0, { duration: 90 }));
      shake.value = withSequence(withTiming(1, { duration: 60 }), withTiming(-1, { duration: 70 }), withTiming(0.6, { duration: 60 }), withTiming(0, { duration: 70 }));
    },
    open: (onDone) => {
      cancelAnimation(halo);
      if (reduce) {
        o.value = withTiming(1, { duration: 180 }, (f) => {
          if (f) scheduleOnRN(onDone);
        });
        return;
      }
      o.value = withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) }, (f) => {
        if (f) scheduleOnRN(onDone);
      });
    },
    finish: () => {
      cancelAnimation(o);
      o.value = 1;
    },
  }));

  const whole = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [0, -6]) }, { rotate: `${tilt.value}deg` }],
  }));
  const body = useAnimatedStyle(() => ({
    opacity: interpolate(o.value, [0.62, 0.95], [1, 0], 'clamp'),
    transform: [{ scale: interpolate(o.value, [0.62, 1], [1, 0.92], 'clamp') }],
  }));
  const flap = useAnimatedStyle(() => ({
    opacity: interpolate(o.value, [0.45, 0.72], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(o.value, [0.4, 0.72], [0, -46 * k], 'clamp') }],
  }));
  const left = useRibbon(o, -70, 0, k);
  const right = useRibbon(o, 70, 0, k);
  const top = useRibbon(o, 0, -60, k);
  const bottom = useRibbon(o, 0, 60, k);
  const seal = useAnimatedStyle(() => {
    const pop = interpolate(o.value, [0, 0.22], [1, 1.18], 'clamp');
    const fly = interpolate(o.value, [0.22, 0.55], [0, 1], 'clamp');
    return {
      opacity: 1 - fly,
      transform: [{ translateX: shake.value * 4 + fly * 40 * k }, { translateY: -fly * 130 * k }, { rotate: `${fly * -32}deg` }, { scale: pop * (1 - fly * 0.2) }],
    };
  });
  const locked = useAnimatedStyle(() => ({ opacity: 1 - unlock.value }));
  const opened = useAnimatedStyle(() => ({ opacity: unlock.value, transform: [{ translateY: (1 - unlock.value) * 4 }] }));
  const glow = useAnimatedStyle(() => ({
    opacity: state === 'ready' ? interpolate(halo.value, [0, 1], [0.55, 0]) * (1 - o.value) : 0,
    transform: [{ scale: interpolate(halo.value, [0, 1], [0.9, 1.7]) }],
  }));

  return (
    <View style={{ width, height: H * k }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[{ width, height: H * k }, whole]}>
        {/* Ombre portée sur la table */}
        <Layer style={body}>
          <Ellipse cx={CX} cy={208} rx={112} ry={8} fill={colors.ink} opacity={0.08} />
          {/* Enveloppe */}
          <Rect x={20} y={60} width={240} height={140} rx={14} fill={PAPER} stroke={PAPER_EDGE} strokeWidth={2} />
          <Path d="M22 198 L140 128 L258 198" fill="none" stroke={PAPER_EDGE} strokeWidth={2} strokeLinejoin="round" />
          {/* Trame de papier */}
          {[78, 94, 176, 186].map((y) => (
            <Path key={y} d={`M36 ${y} h40 M206 ${y} h38`} stroke={PAPER_EDGE} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
          ))}
        </Layer>
        <Layer style={flap}>
          <Path d="M20 72 Q20 60 34 60 L246 60 Q260 60 260 72 L148 136 Q140 141 132 136 Z" fill="#F7EDE3" stroke={PAPER_EDGE} strokeWidth={2} strokeLinejoin="round" />
        </Layer>
        {/* Ruban : quatre moitiés qui se dénouent */}
        <Layer style={left}>
          <Rect x={20} y={118} width={120} height={24} fill={colors.coral} />
          <Rect x={20} y={124} width={120} height={3} fill="#F6806D" />
        </Layer>
        <Layer style={right}>
          <Rect x={140} y={118} width={120} height={24} fill={colors.coral} />
          <Rect x={140} y={124} width={120} height={3} fill="#F6806D" />
        </Layer>
        <Layer style={top}>
          <Rect x={128} y={60} width={24} height={70} fill={colors.coral} />
        </Layer>
        <Layer style={bottom}>
          <Rect x={128} y={130} width={24} height={70} fill={colors.coral} />
        </Layer>
        {/* Halo de la capsule prête */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (CX - 40) * k, top: (CY - 40) * k, width: 80 * k, height: 80 * k, borderRadius: 40 * k, backgroundColor: colors.sun }, glow]} />
        {/* Sceau de cire et son verrou */}
        <Layer style={seal}>
          <Path d={scallop(34)} fill={WAX} />
          <Circle cx={CX} cy={CY} r={25} fill="none" stroke={WAX_DARK} strokeWidth={2} opacity={0.55} />
          <Path d="M118 112 Q124 104 132 102" stroke="#F6806D" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.8} />
        </Layer>
        <Layer style={[seal, locked]}>
          <Path d={`M${CX - 7} ${CY - 2} v-6 a7 7 0 0 1 14 0 v6`} fill="none" stroke={colors.sun} strokeWidth={3.2} strokeLinecap="round" />
          <Rect x={CX - 11} y={CY - 3} width={22} height={17} rx={4} fill={colors.sun} />
          <Circle cx={CX} cy={CY + 5} r={2.4} fill={WAX_DARK} />
        </Layer>
        <Layer style={[seal, opened]}>
          <Path d={`M${CX - 7} ${CY - 2} v-8 a7 7 0 0 1 13 -3`} fill="none" stroke={colors.sun} strokeWidth={3.2} strokeLinecap="round" />
          <Rect x={CX - 11} y={CY - 3} width={22} height={17} rx={4} fill={colors.sun} />
          <Circle cx={CX} cy={CY + 5} r={2.4} fill={WAX_DARK} />
        </Layer>
        {/* Confettis de papier qui s'échappent à l'ouverture */}
        {PIECES.map((p, i) => (
          <Piece key={i} p={p} o={o} k={k} />
        ))}
      </Animated.View>
    </View>
  );
});

/** Petite capsule fermée (carte de l'accueil) : même dessin, sans animation. */
export function CapsuleBadge({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={20} y={60} width={240} height={140} rx={14} fill={PAPER} />
      <Path d="M20 72 Q20 60 34 60 L246 60 Q260 60 260 72 L148 136 Q140 141 132 136 Z" fill="#F7EDE3" />
      <Rect x={20} y={118} width={240} height={24} fill={colors.coral} />
      <Rect x={128} y={60} width={24} height={140} fill={colors.coral} />
      <Path d={scallop(34)} fill={WAX} />
      <Path d={`M${CX - 7} ${CY - 2} v-6 a7 7 0 0 1 14 0 v6`} fill="none" stroke={colors.sun} strokeWidth={4} strokeLinecap="round" />
      <Rect x={CX - 11} y={CY - 3} width={22} height={17} rx={4} fill={colors.sun} />
    </Svg>
  );
}
