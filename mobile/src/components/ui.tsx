import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, fonts, gutter, radius, shadow, space, type } from '@/theme/tokens';

// ------------------------------------------------------------------ Texte
type Variant = keyof typeof type;

export function T({ v = 'body', color = colors.ink, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return (
    <Text
      maxFontSizeMultiplier={v === 'display' || v === 'money' ? 1.4 : 2}
      {...rest}
      style={[type[v] as TextStyle, { color }, style]}
    />
  );
}

// ------------------------------------------------------------------ Écran
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  background = colors.bg,
  contentStyle,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.screenContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.screenContent, { flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ------------------------------------------------------------------ Bouton
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  accessibilityHint,
  compact = false,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const palette = buttonPalette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !reduceMotion && { transform: [{ scale: 0.98 }] },
        pressed && { backgroundColor: palette.pressed },
        disabled && !loading && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon}
      <T v="bodyBold" color={palette.fg} style={{ fontSize: compact ? 15 : 17 }}>
        {label}
      </T>
      {!loading && iconRight}
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.coral, fg: colors.white, border: colors.coral, pressed: colors.coralDark },
  secondary: { bg: colors.violet, fg: colors.white, border: colors.violet, pressed: colors.violetDark },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.ink, pressed: colors.surfaceSoft },
  ghost: { bg: 'transparent', fg: colors.ink, border: 'transparent', pressed: colors.surfaceSoft },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger, pressed: colors.dangerSoft },
  white: { bg: colors.white, fg: colors.coral, border: colors.white, pressed: colors.coralSoft },
};

// ------------------------------------------------------------------ Champ
export const Field = forwardRef<
  React.ComponentRef<typeof TextInput>,
  TextInputProps & { label: string; error?: string | null; hint?: string; icon?: ReactNode; suffix?: string; right?: ReactNode }
>(function Field({ label, error, hint, icon, suffix, right, style, ...rest }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="label" color={colors.ink}>
        {label}
      </T>
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.violet, borderWidth: 2 },
          !!error && { borderColor: colors.danger, borderWidth: 2 },
        ]}
      >
        {icon}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          accessibilityHint={hint}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, rest.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }, style]}
        />
        {suffix ? <T color={colors.inkSoft}>{suffix}</T> : null}
        {right}
      </View>
      {error ? (
        <T v="small" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T v="small" color={colors.inkSoft}>
          {hint}
        </T>
      ) : null}
    </View>
  );
});

// ------------------------------------------------------------------ Carte
export function Card({
  children,
  style,
  tone = 'surface',
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'lavender' | 'soft' | 'violet' | 'coral';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const bg = {
    surface: colors.surface,
    lavender: colors.lavender,
    soft: colors.surfaceSoft,
    violet: colors.violet,
    coral: colors.coral,
  }[tone];
  const base = [styles.card, { backgroundColor: bg }, tone === 'surface' && styles.cardBorder, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

// ------------------------------------------------------------------ Pastille
export function Chip({ label, tone = 'lavender' }: { label: string; tone?: 'lavender' | 'coral' | 'mint' | 'sun' | 'grey' }) {
  const map = {
    lavender: [colors.lavender, colors.violetDark],
    coral: [colors.coralSoft, colors.coralDark],
    mint: [colors.mint, colors.success],
    sun: [colors.sunSoft, '#8A5A00'],
    grey: ['#F1EDF3', colors.inkSoft],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <T v="small" color={fg} style={{ fontFamily: fonts.bold }}>
        {label}
      </T>
    </View>
  );
}

// ------------------------------------------------------------------ Bandeau
export function Banner({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warning' | 'error' | 'demo'; title?: string; children?: ReactNode; icon?: ReactNode }) {
  const map = {
    info: [colors.lavender, colors.ink],
    warning: [colors.sunSoft, colors.ink],
    error: [colors.dangerSoft, colors.danger],
    demo: [colors.sunSoft, colors.ink],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <T v="label" color={fg}>
            {title}
          </T>
        ) : null}
        {typeof children === 'string' ? (
          <T v="small" color={fg}>
            {children}
          </T>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Divers
export function Row({ children, style, gap = space.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function ProgressBar({ value, track = colors.coralSoft, fill = colors.coral, height = 10, label }: { value: number; track?: string; fill?: string; height?: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height, backgroundColor: fill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  footer: { paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.lg, backgroundColor: 'transparent' },
  button: {
    minHeight: 54,
    borderRadius: radius.button,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  buttonCompact: { minHeight: 44, paddingHorizontal: space.lg },
  field: {
    minHeight: 52,
    borderRadius: radius.field,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  input: { flex: 1, fontFamily: fonts.semiBold, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  card: { borderRadius: radius.card, padding: space.lg, ...shadow.card },
  cardBorder: { borderWidth: 1, borderColor: colors.border },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  banner: { borderRadius: radius.field, padding: space.md, flexDirection: 'row', gap: space.md, alignItems: 'center' },
});
