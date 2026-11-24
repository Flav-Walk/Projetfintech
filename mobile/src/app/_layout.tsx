import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Banner, Button, T } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/env';
import { ToastProvider } from '@/lib/toast';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Barrière d'erreur (Expo Router) : un écran qui plante affiche ceci au lieu d'une page blanche. */
export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24, gap: 16 }} accessibilityRole="alert">
      <T v="h1">Oups, cet écran a trébuché</T>
      <T color={colors.inkSoft}>Rien n’est perdu : tes données sont enregistrées. Réessaie, ou reviens à l’accueil.</T>
      <Button label="Réessayer" onPress={() => void retry()} />
    </View>
  );
}

// Version web de l'app : espace privé, jamais indexé (complète public/robots.txt ; la protection réelle est en base).
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.querySelector('meta[name="robots"]')) {
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.appendChild(meta);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Caveat_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }} />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
