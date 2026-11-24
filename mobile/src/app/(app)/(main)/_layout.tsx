import { Tabs } from 'expo-router';
import { Bell, Gift, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserAvatar } from '@/components/avatar';
import { StartButton } from '@/components/start-menu';
import { T } from '@/components/ui';
import { hapticTap } from '@/lib/haptics';
import { useNotifications, useProfile } from '@/lib/queries';
import { useClaimEmailInvites, useFriends, useReceivedInvites, useSocialRealtime } from '@/lib/social';
import { colors, fonts, shadow, space } from '@/theme/tokens';

const TABS = {
  events: { label: 'Accueil', Icon: Gift },
  friends: { label: 'Amis', Icon: Users },
  notifications: { label: 'Activité', Icon: Bell },
  profile: { label: 'Profil', Icon: null },
} as const;
type TabName = keyof typeof TABS;

/**
 * Navigation principale : Accueil (mes cagnottes, invitations, souvenirs), Amis, Activité, Profil.
 * Le bouton central ouvre les deux façons de commencer : créer une cagnotte ou en rejoindre une.
 * Onglet actif : icône et libellé à l'encre, repère soleil sous l'icône (jamais de pastille colorée).
 */
export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const notifications = useNotifications();
  const friends = useFriends();
  const received = useReceivedInvites();
  const profile = useProfile();
  useSocialRealtime();
  useClaimEmailInvites();

  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;
  const incoming = friends.data?.filter((f) => f.relation === 'incoming').length ?? 0;
  const invites = received.data?.length ?? 0;
  const badges: Partial<Record<TabName, number>> = { notifications: unread, friends: incoming, events: invites };

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg }, animation: 'shift' }}
      tabBar={({ state, navigateToTab }) => {
        const items = state.routes.map((route, i) => {
          const name = route.name as TabName;
          const def = TABS[name];
          if (!def) return null;
          const focused = state.index === i;
          const color = focused ? colors.ink : colors.inkFaint;
          const count = badges[name] ?? 0;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={count ? `${def.label}, ${count} nouveau${count > 1 ? 'x' : ''}` : def.label}
              onPress={() => {
                if (!focused) {
                  hapticTap();
                  navigateToTab(route.key);
                }
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 3 }}
            >
              <View>
                {def.Icon ? (
                  <def.Icon size={24} color={color} strokeWidth={focused ? 2.25 : 1.75} />
                ) : (
                  <View style={{ borderRadius: 14, borderWidth: 2, borderColor: focused ? colors.ink : 'transparent' }}>
                    <UserAvatar name={profile.data?.display_name ?? '?'} path={profile.data?.avatar_path} seed={profile.data?.id} size={24} ring={null} />
                  </View>
                )}
                {count > 0 ? (
                  <View style={{ position: 'absolute', top: -4, right: -9, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.coralDark, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <T v="small" color={colors.white} maxFontSizeMultiplier={1.1} style={{ fontFamily: fonts.extraBold, fontSize: 10, lineHeight: 12 }}>
                      {count > 9 ? '9+' : count}
                    </T>
                  </View>
                ) : null}
              </View>
              <T v="small" color={color} maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 11, lineHeight: 14, fontFamily: focused ? fonts.extraBold : fonts.bold }}>
                {def.label}
              </T>
              <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: focused ? colors.sun : 'transparent' }} />
            </Pressable>
          );
        });
        return (
          <View
            accessibilityRole="tablist"
            style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 4), paddingTop: 6, paddingHorizontal: space.sm }, shadow.card]}
          >
            {items.slice(0, 2)}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <StartButton />
            </View>
            {items.slice(2)}
          </View>
        );
      }}
    >
      <Tabs.Screen name="events" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
