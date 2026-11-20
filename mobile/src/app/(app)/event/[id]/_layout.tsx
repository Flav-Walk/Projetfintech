import { Stack } from 'expo-router';
import { CelebrationHost } from '@/components/celebration';
import { useEventId } from '@/lib/use-event-context';
import { colors } from '@/theme/tokens';

export default function EventLayout() {
  const id = useEventId();
  return (
    <CelebrationHost eventId={id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </CelebrationHost>
  );
}
