import { Redirect, Stack } from 'expo-router';
import { CelebrationHost } from '@/components/celebration';
import { Loading } from '@/components/states';
import { useMyRole } from '@/lib/surprise';
import { useEventId } from '@/lib/use-event-context';
import { colors } from '@/theme/tokens';

/**
 * Espace d'une cagnotte (préparateurs). La personne fêtée n'y entre jamais : quel que soit le chemin
 * (lien, notification, carte), elle est envoyée vers son espace dédié, la capsule. La base refuse de toute
 * façon les données des préparatifs à ce rôle ; cet aiguillage évite seulement des écrans vides.
 */
export default function EventLayout() {
  const id = useEventId();
  const role = useMyRole(id);
  if (role.isPending) return <Loading />;
  if (role.data === 'beneficiary') return <Redirect href={{ pathname: '/surprise/[id]', params: { id } }} />;
  return (
    <CelebrationHost eventId={id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </CelebrationHost>
  );
}
