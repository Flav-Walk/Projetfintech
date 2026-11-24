import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { coverFor, type CoverArt } from '@/lib/covers';
import { signedUrl } from '@/lib/media';
import { CoverArtView } from './cover-art';

type EventLike = { cover_path: string | null; cover_art?: string | null; occasion: string; title?: string };

/**
 * Couverture d'une cagnotte. L'illustration (choisie ou selon l'occasion) est toujours dessinée dessous :
 * pendant le chargement de la photo, si l'URL signée échoue ou si l'image est illisible, on la voit,
 * jamais un rectangle vide. La photo apparaît en fondu par-dessus quand elle est prête.
 */
export function EventCover({ event, style, localUri, art: forcedArt }: { event: EventLike; style?: StyleProp<ViewStyle>; localUri?: string | null; art?: CoverArt }) {
  const src = coverFor(event);
  const path = src.kind === 'photo' ? src.path : null;
  const art = forcedArt ?? (src.kind === 'photo' ? src.fallback : src.art);
  const [failed, setFailed] = useState<string | null>(null);
  const url = useQuery({
    queryKey: ['signed-url', 'event-media', path],
    enabled: !!path && !localUri,
    staleTime: 8 * 60 * 1000,
    gcTime: 9 * 60 * 1000,
    queryFn: () => signedUrl('event-media', path!),
  });
  const uri = localUri ?? (path && failed !== path ? url.data : null) ?? null;
  return (
    <View style={[{ overflow: 'hidden' }, style]} accessible accessibilityRole="image" accessibilityLabel={event.title ? `Couverture de ${event.title}` : 'Couverture'}>
      <CoverArtView art={art} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {uri ? (
        <Image
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          transition={220}
          onError={() => setFailed(path)}
        />
      ) : null}
    </View>
  );
}
