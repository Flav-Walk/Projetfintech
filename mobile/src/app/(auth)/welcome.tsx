import { router } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { View } from 'react-native';
import { Mascot } from '@/components/mascot';
import { Button, Screen, T } from '@/components/ui';
import { colors, space } from '@/theme/tokens';

export default function Welcome() {
  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.xl }}>
        <T v="display" style={{ fontSize: 46, lineHeight: 50 }} accessibilityRole="header">
          complice
        </T>
        <T color={colors.inkSoft} style={{ textAlign: 'center', fontSize: 17 }}>
          Le cadeau commun{'\n'}qu’on prépare ensemble
        </T>
      </View>
      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Mascot size={150} mood="wink" />
      </View>
      <View style={{ gap: space.md }}>
        <T v="small" color={colors.inkSoft} style={{ textAlign: 'center' }}>
          Cagnotte, idées, votes, missions et une capsule de mots pour la personne fêtée.
        </T>
        <Button label="Créer un compte" onPress={() => router.push('/sign-up')} />
        <Button label="Se connecter" variant="outline" onPress={() => router.push('/sign-in')} />
        <Button
          label="J’ai un lien d’invitation"
          variant="ghost"
          icon={<Link2 size={20} color={colors.ink} strokeWidth={1.75} />}
          onPress={() => router.push('/join')}
        />
      </View>
    </Screen>
  );
}
