import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { colors, radius, shadow, space } from '@/theme/tokens';

type Toast = { id: number; text: string; tone: 'success' | 'error' | 'info'; action?: { label: string; onPress: () => void } };
type ToastApi = { show: (t: Omit<Toast, 'id'> & { duration?: number }) => void };

const Ctx = createContext<ToastApi>({ show: () => {} });

/**
 * Confirmations brèves en bas d'écran (annoncées au lecteur d'écran), avec action facultative
 * (« Annuler »). Une seule à la fois : la suivante remplace la précédente.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback<ToastApi['show']>(({ duration, ...t }) => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setToast({ ...t, id });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), duration ?? (t.action ? 5000 : 3000));
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          pointerEvents="box-none"
          style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: Math.max(insets.bottom, space.md) + 72 }}
        >
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole={toast.tone === 'error' ? 'alert' : undefined}
            style={[{ backgroundColor: colors.ink, borderRadius: radius.field, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md }, shadow.raised]}
          >
            {toast.tone === 'error' ? <CircleAlert size={20} color={colors.coralSoft} /> : <CircleCheck size={20} color={colors.mint} />}
            <T v="label" color={colors.white} style={{ flex: 1 }}>
              {toast.text}
            </T>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  toast.action!.onPress();
                  setToast(null);
                }}
              >
                <T v="label" color={colors.sun}>
                  {toast.action.label}
                </T>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
