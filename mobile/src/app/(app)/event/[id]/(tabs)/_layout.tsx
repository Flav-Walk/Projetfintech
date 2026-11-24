import { Tabs } from 'expo-router';
import { House, Lightbulb, ListChecks, Mailbox, MessagesSquare } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { hapticTap } from '@/lib/haptics';
import { colors, fonts, shadow, space } from '@/theme/tokens';

const ICONS = { index: House, ideas: Lightbulb, missions: ListChecks, capsule: Mailbox, chat: MessagesSquare } as const;
const LABELS = { index: 'Accueil', ideas: 'Idées', missions: 'Missions', capsule: 'Capsule', chat: 'Discussion' } as const;

/** Espace d'une cagnotte : 5 onglets. Actif : encre + repère soleil, comme la barre principale. */
export default function EventTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}
      tabBar={({ state, navigateToTab }) => (
        <View
          accessibilityRole="tablist"
          style={[{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 4), paddingTop: 6, paddingHorizontal: space.xs }, shadow.card]}
        >
          {state.routes.map((route, i) => {
            const name = route.name as keyof typeof ICONS;
            const Icon = ICONS[name] ?? House;
            const focused = state.index === i;
            const color = focused ? colors.ink : colors.inkFaint;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={LABELS[name]}
                onPress={() => {
                  if (!focused) {
                    hapticTap();
                    navigateToTab(route.key);
                  }
                }}
                style={{ flex: 1, alignItems: 'center', gap: 3, minHeight: 52, justifyContent: 'center' }}
              >
                <Icon size={23} color={color} strokeWidth={focused ? 2.25 : 1.75} />
                <T v="small" color={color} maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 11, lineHeight: 14, fontFamily: focused ? fonts.extraBold : fonts.bold }}>
                  {LABELS[name]}
                </T>
                <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: focused ? colors.sun : 'transparent' }} />
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ideas" />
      <Tabs.Screen name="missions" />
      <Tabs.Screen name="capsule" />
      <Tabs.Screen name="chat" />
    </Tabs>
  );
}
