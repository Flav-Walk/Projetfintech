import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Banner, T } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, Caveat_600SemiBold });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Reprise automatique seulement pour les erreurs transitoires (réseau, 5xx), jamais pour un refus.
          queries: { retry: (n, e) => n < 2 && /network|fetch|timeout|50[234]/i.test(String((e as Error)?.message)), staleTime: 15_000, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 12 }}>
          <T v="h2">Configuration manquante</T>
          <Banner tone="error" title="Supabase n’est pas configuré">
            Copie mobile/.env.example en mobile/.env, renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, puis relance Expo.
          </Banner>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
