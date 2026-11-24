import { Check, ChevronRight, X } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticTap } from '@/lib/haptics';
import { colors, fonts, gutter, radius, space } from '@/theme/tokens';
import { T } from './ui';

// ------------------------------------------------------------------ Contrôle segmenté
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', backgroundColor: colors.sand, borderRadius: radius.pill, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) hapticTap();
              onChange(o.key);
            }}
            style={{ flex: 1, minHeight: 44, paddingHorizontal: space.sm, borderRadius: radius.pill, backgroundColor: selected ? colors.surface : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
          >
            <T v="label" color={selected ? colors.ink : colors.inkSoft} numberOfLines={1}>
              {o.label}
            </T>
            {o.count ? (
              <View style={{ minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: selected ? colors.coral : colors.inkFaint, alignItems: 'center', justifyContent: 'center' }}>
                <T v="small" color={colors.white} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16 }}>
                  {o.count}
                </T>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ Interrupteur aux couleurs COMPLICE (iOS, Android, web)
export function Toggle({ value, onValueChange, label, disabled }: { value: boolean; onValueChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const webColors = Platform.OS === 'web' ? ({ activeThumbColor: colors.white, activeTrackColor: colors.violet } as object) : {};
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        hapticTap();
        onValueChange(v);
      }}
      thumbColor={colors.white}
      trackColor={{ true: colors.violet, false: colors.border }}
      ios_backgroundColor={colors.border}
      accessibilityLabel={label}
      {...webColors}
    />
  );
}

// ------------------------------------------------------------------ Puce sélectionnable
export function ChoiceChip({ label, selected, onPress, icon, tone = 'violet' }: { label: string; selected: boolean; onPress: () => void; icon?: ReactNode; tone?: 'violet' | 'coral' }) {
  const on = tone === 'coral' ? colors.coral : colors.violet;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      android_ripple={{ color: colors.lavenderStrong }}
      style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: selected ? on : colors.border, backgroundColor: selected ? on : colors.surface, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {icon}
      <T v="label" color={selected ? colors.white : colors.ink}>
        {label}
      </T>
    </Pressable>
  );
}

// ------------------------------------------------------------------ Ligne de liste
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  accessibilityLabel,
  chevron = false,
  style,
}: {
  title: string;
  subtitle?: string | null;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyBold" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T v="small" color={colors.inkSoft} numberOfLines={2}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={20} color={colors.inkFaint} /> : null}
    </>
  );
  const base: StyleProp<ViewStyle> = [{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingVertical: space.sm, backgroundColor: colors.surface }, style];
  if (!onPress) return <View style={base}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} onPress={onPress} android_ripple={{ color: colors.sand }} style={({ pressed }) => [base, pressed && Platform.OS !== 'android' && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

// ------------------------------------------------------------------ Groupe de lignes (carte sans ombre)
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.lg, overflow: 'hidden' }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

// ------------------------------------------------------------------ En-tête d'onglet principal
export function PageHeader({ title, subtitle, caption, right }: { title: string; subtitle?: string | null; caption?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingTop: space.sm }}>
      <View style={{ flex: 1 }}>
        {subtitle ? (
          <T v="overline" color={colors.inkSoft}>
            {subtitle}
          </T>
        ) : null}
        <T v="h1" accessibilityRole="header">
          {title}
        </T>
        {caption ? (
          <T v="small" color={colors.inkSoft} selectable>
            {caption}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ------------------------------------------------------------------ Titre de section
export function SectionHeader({ title, action, count }: { title: string; action?: { label: string; onPress: () => void }; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm }}>
      <T v="h3" accessibilityRole="header">
        {title}
        {count !== undefined ? <T v="h3" color={colors.inkFaint}>{`  ${count}`}</T> : null}
      </T>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={action.onPress}>
          <T v="label" color={colors.violet}>
            {action.label}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Pastille d'icône
export function IconCircle({ children, bg = colors.lavender, size = 44 }: { children: ReactNode; bg?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

// ------------------------------------------------------------------ Case à cocher ronde (sélection multiple)
export function CheckDot({ checked }: { checked: boolean }) {
  return (
    <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: checked ? colors.violet : colors.inkFaint, backgroundColor: checked ? colors.violet : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {checked ? <Check size={16} color={colors.white} strokeWidth={3} /> : null}
    </View>
  );
}

// ------------------------------------------------------------------ Squelette de chargement
export function Skeleton({ height = 16, width = '100%', radius: r = 8, style }: { height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const o = useSharedValue(0.55);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o, reduce]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no" style={[{ height, width, borderRadius: r, backgroundColor: colors.sand }, anim, style]} />;
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ gap: space.md }} accessibilityLabel="Chargement" accessible>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Skeleton height={44} width={44} radius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------------------ Feuille modale (bas d'écran)
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }} />
        <Animated.View
          entering={reduce ? FadeIn.duration(120) : SlideInDown.duration(260)}
          accessibilityViewIsModal
          style={{ maxHeight: '92%', backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: Math.max(insets.bottom, space.lg) }}
        >
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: gutter, paddingTop: space.md, gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T v="h2" accessibilityRole="header">
                {title}
              </T>
              {subtitle ? <T color={colors.inkSoft}>{subtitle}</T> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" hitSlop={12} onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: gutter, gap: space.lg }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: gutter, paddingTop: space.sm }}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------------------------------------------------------------------ Ligne à balayer (actions rapides)
export type SwipeAction = { label: string; icon: ReactNode; color: string; onPress: () => void };

/**
 * Balayer vers la gauche révèle des actions. Les mêmes actions restent accessibles sans geste
 * (lecteur d'écran : actions personnalisées ; bouton « … » ou appui long côté écran).
 */
export function SwipeRow({ children, actions, enabled = true }: { children: ReactNode; actions: SwipeAction[]; enabled?: boolean }) {
  if (!enabled || actions.length === 0) return <>{children}</>;
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_p, _t, methods) => (
        <View style={{ flexDirection: 'row' }}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => {
                methods.close();
                a.onPress();
              }}
              style={{ width: 84, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              {a.icon}
              <T v="small" color={colors.white} style={{ fontFamily: fonts.bold }}>
                {a.label}
              </T>
            </Pressable>
          ))}
        </View>
      )}
    >
      <View
        accessible
        accessibilityActions={actions.map((a) => ({ name: a.label, label: a.label }))}
        onAccessibilityAction={(e) => actions.find((a) => a.label === e.nativeEvent.actionName)?.onPress()}
      >
        {children}
      </View>
    </ReanimatedSwipeable>
  );
}
