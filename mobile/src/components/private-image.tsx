import { useQuery } from '@tanstack/react-query';
import { Image, type ImageStyle } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { signedUrl } from '@/lib/media';
import { colors } from '@/theme/tokens';

/**
 * Image d'un bucket privé, servie par une URL signée de 10 min (renouvelée avant expiration).
 * `localUri` affiche l'aperçu immédiat d'une image tout juste choisie.
 */
export function PrivateImage({
  bucket = 'event-media',
  path,
  localUri,
  style,
  label,
}: {
  bucket?: 'avatars' | 'event-media';
  path: string | null;
  localUri?: string | null;
  style: StyleProp<ImageStyle & ViewStyle>;
  label: string;
}) {
  const url = useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path && !localUri,
    staleTime: 8 * 60 * 1000,
    gcTime: 9 * 60 * 1000,
    queryFn: () => signedUrl(bucket, path!),
  });
  const uri = localUri ?? url.data ?? null;
  if (!uri) {
    return (
      <View style={[{ backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' }, style as StyleProp<ViewStyle>]} accessibilityLabel={label}>
        {url.isPending && !!path ? <ActivityIndicator color={colors.coral} /> : <ImageOff color={colors.inkFaint} size={24} />}
      </View>
    );
  }
  return <Image source={{ uri }} style={style} contentFit="cover" transition={150} accessibilityLabel={label} accessible />;
}
