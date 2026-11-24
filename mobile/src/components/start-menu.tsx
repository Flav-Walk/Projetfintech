import { router } from 'expo-router';
import { ArrowRight, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, View, findNodeHandle, useWindowDimensions } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { hapticTap } from '@/lib/haptics';
import { colors, fonts, gutter, radius, shadow, space } from '@/theme/tokens';
import { T } from './ui';

/**
 * Bouton « + » de la barre principale et son menu : créer ou rejoindre une cagnotte.
 * - Une seule valeur d'animation (0 → 1) pilote le bouton (rotation en ×, passage à l'encre),
 *   le voile papier et les deux choix, qui sortent du bouton avec un léger décalage. Pas de rebond.
 * - Fermeture symétrique, plus courte. Appuis répétés : l'animation repart de sa position actuelle.
 * - Retour Android et touche Échap (web) ferment le menu ; « Réduire les animations » : fondu court.
 * - Le menu est une fenêtre modale (focus piégé) ; le premier choix reçoit le focus à l'ouverture.
 */
const FAB = 56;
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 1, 1);

type Frame = { x: number; y: number };

/** Élément i du menu : apparaît après les précédents (le plus proche du bouton d'abord). */
function useStagger(p: SharedValue<number>, i: number, reduce: boolean) {
  return useAnimatedStyle(() => {
    const start = i * 0.18;
    const t = interpolate(p.value, [start, start + 0.82], [0, 1], 'clamp');
    return {
      opacity: t,
      transform: reduce ? [] : [{ translateY: (1 - t) * (28 + i * 10) }, { scale: 0.94 + 0.06 * t }],
    };
  });
}

export function StartButton() {
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const fabRef = useRef<React.ComponentRef<typeof View>>(null);
  const firstRef = useRef<React.ComponentRef<typeof View>>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const p = useSharedValue(0);

  const unmount = useCallback(() => setMounted(false), []);

  const show = () => {
    hapticTap();
    fabRef.current?.measureInWindow((x: number, y: number) => {
      setFrame({ x, y });
      setMounted(true);
      setOpen(true);
    });
  };
  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!mounted) return;
    if (open) {
      p.value = withTiming(1, { duration: reduce ? 120 : 280, easing: EASE_OUT });
      // Focus sur le premier choix (lecteur d'écran natif, clavier sur le web).
      const t = setTimeout(() => {
        if (Platform.OS === 'web') (firstRef.current as unknown as HTMLElement | null)?.focus?.();
        else {
          const node = firstRef.current ? findNodeHandle(firstRef.current) : null;
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      }, reduce ? 60 : 200);
      return () => clearTimeout(t);
    }
    p.value = withTiming(0, { duration: reduce ? 100 : 190, easing: EASE_IN }, (finished) => {
      if (finished) scheduleOnRN(unmount);
    });
  }, [open, mounted, reduce, p, unmount]);

  const go = (path: '/create' | '/join') => {
    hide();
    router.push(path);
  };

  // Pictogramme : rotation de 45° (le + devient ×) ; fond du bouton : corail → encre.
  const fabAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(p.value, [0, 1], [0, 45])}deg` }],
  }));
  const fabInk = useAnimatedStyle(() => ({ opacity: p.value }));
  const veil = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0, 1]) }));
  const near = useStagger(p, 0, reduce);
  const far = useStagger(p, 1, reduce);
  const title = useStagger(p, 2, reduce);

  const fabTop = frame ? frame.y : 0;
  const fabLeft = frame ? frame.x : 0;

  return (
    <>
      <View ref={fabRef} collapsable={false} style={{ width: FAB, height: FAB, marginTop: -22 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer ou rejoindre une cagnotte"
          accessibilityState={{ expanded: open }}
          onPress={show}
          style={({ pressed }) => [{ width: FAB, height: FAB, borderRadius: 20, backgroundColor: pressed ? colors.coralPressed : colors.coralDark, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }, { scale: pressed ? 0.96 : 1 }] }, shadow.raised]}
        >
          <Plus size={28} color={colors.white} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Modal visible={mounted} transparent animationType="none" onRequestClose={hide} statusBarTranslucent navigationBarTranslucent>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(251, 245, 238, 0.94)' }, veil]}>
          <Pressable accessibilityLabel="Fermer le menu" accessibilityRole="button" onPress={hide} style={{ flex: 1 }} />
        </Animated.View>

        <View
          accessibilityViewIsModal
          pointerEvents={open ? 'box-none' : 'none'}
          style={{ position: 'absolute', left: gutter, right: gutter, bottom: Math.max(height - fabTop + space.lg, 120), gap: space.md }}
        >
          <Animated.View style={title}>
            <T v="h1" accessibilityRole="header">
              On commence ?
            </T>
          </Animated.View>
          <Animated.View style={far}>
            <Choice
              tone="paper"
              title="Rejoindre une cagnotte"
              text="Avec un lien ou un code reçu"
              art={<TicketArt />}
              onPress={() => go('/join')}
            />
          </Animated.View>
          <Animated.View style={near}>
            <Choice ref={firstRef} tone="coral" title="Créer une cagnotte" text="Anniversaire, départ, naissance…" art={<GiftArt />} onPress={() => go('/create')} />
          </Animated.View>
        </View>

        {/* Réplique du bouton, au même endroit, qui devient la croix de fermeture */}
        {frame ? (
          <View style={{ position: 'absolute', top: fabTop, left: fabLeft, width: FAB, height: FAB }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer le menu"
              onPress={hide}
              style={[{ width: FAB, height: FAB, borderRadius: 20, backgroundColor: colors.coralDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-4deg' }] }, shadow.raised]}
            >
              <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.ink }, fabInk]} />
              {/* Seul le pictogramme tourne : le + devient une croix. */}
              <Animated.View style={[{ position: 'relative', zIndex: 1 }, fabAnim]}>
                <Plus size={28} color={colors.white} strokeWidth={2.5} />
              </Animated.View>
            </Pressable>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

type ChoiceProps = { tone: 'coral' | 'paper'; title: string; text: string; art: React.ReactNode; onPress: () => void; ref?: React.Ref<React.ComponentRef<typeof View>> };

function Choice({ tone, title, text, art, onPress, ref }: ChoiceProps) {
  const coral = tone === 'coral';
  const fg = coral ? colors.white : colors.ink;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      onPress={onPress}
      android_ripple={{ color: coral ? colors.coralPressed : colors.sand }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: 84,
          paddingVertical: space.md,
          paddingLeft: space.md,
          paddingRight: space.lg,
          borderRadius: radius.cover,
          overflow: 'hidden',
          backgroundColor: coral ? (pressed ? colors.coralPressed : colors.coralDark) : pressed ? colors.sand : colors.surface,
          borderWidth: coral ? 0 : 1.5,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        shadow.card,
      ]}
    >
      <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: coral ? 'rgba(255,255,255,0.14)' : colors.sunSoft, alignItems: 'center', justifyContent: 'center' }}>{art}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T v="h3" color={fg} style={{ fontSize: 17, lineHeight: 22 }}>
          {title}
        </T>
        <T v="small" color={coral ? colors.coralSoft : colors.inkSoft} style={{ fontFamily: fonts.bold }}>
          {text}
        </T>
      </View>
      <ArrowRight size={20} color={fg} strokeWidth={2.25} />
    </Pressable>
  );
}

/** Pictogramme « créer » : un paquet ficelé, ruban soleil (dessiné pour COMPLICE). */
function GiftArt() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Rect x={8} y={18} width={28} height={20} rx={4} fill={colors.white} />
      <Rect x={6} y={13} width={32} height={8} rx={3} fill={colors.blush} />
      <Rect x={19.5} y={13} width={5} height={25} fill={colors.sun} />
      <Path d="M22 13 C17 4 9 7 12.5 11.5 C14.5 13.5 19 13.5 22 13 Z M22 13 C27 4 35 7 31.5 11.5 C29.5 13.5 25 13.5 22 13 Z" fill={colors.sun} />
      <Circle cx={22} cy={13} r={2.6} fill="#F5A623" />
    </Svg>
  );
}

/** Pictogramme « rejoindre » : un billet d'entrée avec son lien. */
function TicketArt() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Path d="M6 14 h32 a2 2 0 0 1 2 2 v4 a3.2 3.2 0 0 0 0 6.4 v4 a2 2 0 0 1 -2 2 h-32 a2 2 0 0 1 -2 -2 v-4 a3.2 3.2 0 0 0 0 -6.4 v-4 a2 2 0 0 1 2 -2 z" fill={colors.coral} transform="rotate(-8 22 23)" />
      <Path d="M29 16 v18" stroke={colors.coralSoft} strokeWidth={1.6} strokeDasharray="2 2.6" transform="rotate(-8 22 23)" />
      <Path d="M13.5 25.5 l-1.6 1.6 a3 3 0 0 0 4.2 4.2 l1.6 -1.6 M18.5 20.5 l1.6 -1.6 a3 3 0 0 1 4.2 4.2 l-1.6 1.6 M16 26 l5 -5" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
