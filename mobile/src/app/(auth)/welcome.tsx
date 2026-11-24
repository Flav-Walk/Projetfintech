import { router } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/mascot';
import { Banner, Button, T } from '@/components/ui';
import { WelcomeScene } from '@/components/welcome-scene';
import { useAuth } from '@/lib/auth';
import { colors, gutter, space } from '@/theme/tokens';

/**
 * Accueil avant connexion : une composition identifiable (logo, scène du cadeau commun, promesse courte),
 * les trois entrées hiérarchisées dans la zone du pouce : créer un compte, se connecter, rejoindre par invitation.
 */
export default function Welcome() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const { width, height } = useWindowDimensions();
  // La scène occupe l'espace disponible sans repousser les boutons hors de l'écran : plus petite sur un
  // écran court, plus grande sur un grand téléphone, plafonnée sur tablette.
  const compact = height < 700;
  const narrow = width < 360;
  const sceneW = Math.min(width - gutter * 2, 460);
  // Hauteur restante une fois logo, promesse et actions placés (approximation, bornée).
  const sceneH = Math.max(190, Math.min(compact ? height * 0.36 : height - (narrow ? 500 : 450), 520));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingTop: space.md, paddingBottom: space.lg }} bounces={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size="sm" />
        </View>
        {sessionExpired ? (
          <View style={{ marginTop: space.md }}>
            <Banner tone="info" title="Ta session a pris fin">
              Reconnecte-toi : rien n’a été perdu.
            </Banner>
          </View>
        ) : null}

        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: compact ? space.sm : space.lg }}>
          <WelcomeScene width={sceneW} height={sceneH} />
        </View>

        <View style={{ gap: space.sm, marginBottom: compact ? space.lg : space.xl }}>
          <T v={compact ? 'h1' : 'display'} accessibilityRole="header" style={compact ? { fontSize: 27, lineHeight: 31 } : undefined}>
            Offrez à plusieurs,{'\n'}sans prise de tête.
          </T>
          <T color={colors.inkSoft}>Idées, votes, cagnotte et mots surprises : tout le groupe au même endroit.</T>
        </View>

        <View style={{ gap: space.md }}>
          <Button label="Créer mon compte" onPress={() => router.push('/sign-up')} />
          <View style={{ flexDirection: narrow ? 'column' : 'row', gap: narrow ? space.xs : space.md }}>
            <Button
              compact
              variant="outline"
              label="Se connecter"
              style={narrow ? undefined : { flex: 1 }}
              onPress={() => {
                clearSessionExpired();
                router.push('/sign-in');
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="J’ai reçu une invitation"
              onPress={() => router.push('/join')}
              android_ripple={{ color: colors.sand }}
              style={({ pressed }) => ({ flex: narrow ? undefined : 1, minHeight: 44, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: pressed ? colors.sand : 'transparent' })}
            >
              <Link2 size={18} color={colors.ink} strokeWidth={2.25} />
              <T v="label" color={colors.ink} numberOfLines={1}>
                J’ai une invitation
              </T>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
