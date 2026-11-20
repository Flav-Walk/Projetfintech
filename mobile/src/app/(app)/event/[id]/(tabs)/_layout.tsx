import { Tabs } from 'expo-router';
import { Flag, House, Lightbulb, MessagesSquare, Pill } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/ui';
import { colors, fonts } from '@/theme/tokens';

const ICONS = { index: House, ideas: Lightbulb, missions: Flag, capsule: Pill, chat: MessagesSquare } as const;
const LABELS = { index: 'Accueil', ideas: 'Idées', missions: 'Missions', capsule: 'Capsule', chat: 'Discussion' } as const;

export default function EventTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={({ state, navigateToTab }) => (
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8 }}
        >
          {state.routes.map((route, i) => {
            const name = route.name as keyof typeof ICONS;
            const Icon = ICONS[name] ?? House;
            const focused = state.index === i;
            const color = focused ? colors.coral : colors.ink;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={LABELS[name]}
                onPress={() => {
                  if (!focused) navigateToTab(route.key);
                }}
                style={{ flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'center' }}
              >
                <Icon size={24} color={color} strokeWidth={1.75} />
                <T v="small" color={color} style={{ fontSize: 12, fontFamily: focused ? fonts.extraBold : fonts.semiBold }}>
                  {LABELS[name]}
                </T>
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
