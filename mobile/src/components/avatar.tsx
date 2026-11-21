import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { initials } from '@/lib/format';
import { signedUrl } from '@/lib/media';
import { avatarTints, colors, fonts } from '@/theme/tokens';
import { T } from './ui';

/** Teinte stable par personne (même couleur partout pour un même nom ou identifiant). */
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return avatarTints[Math.abs(h) % avatarTints.length]!;
}

/**
 * Avatar : photo de profil (bucket privé, URL signée courte) ou initiales sur pastel.
 * La photo n'est servie que si la base l'autorise (groupe commun, amis, invitation en cours).
 */
export function UserAvatar({
  name,
  path,
  size = 40,
  seed,
  ring = colors.white,
  localUri,
}: {
  name: string;
  path?: string | null;
  size?: number;
  seed?: string;
  ring?: string | null;
  localUri?: string | null;
}) {
  const url = useQuery({
    queryKey: ['signed-url', 'avatars', path],
    enabled: !!path && !localUri,
    staleTime: 8 * 60 * 1000,
    gcTime: 9 * 60 * 1000,
    queryFn: () => signedUrl('avatars', path!),
  });
  const uri = localUri ?? url.data ?? null;
  const box = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? Math.max(2, Math.round(size / 20)) : 0,
    borderColor: ring ?? 'transparent',
    overflow: 'hidden' as const,
  };
  if (uri) {
    return (
      <View style={box} accessibilityLabel={`Photo de ${name}`} accessible>
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
      </View>
    );
  }
  return (
    <View style={[box, { backgroundColor: tintFor(seed ?? name), alignItems: 'center', justifyContent: 'center' }]} accessibilityLabel={name} accessible>
      <T v="small" maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extraBold, fontSize: Math.max(11, size * 0.36), lineHeight: Math.max(14, size * 0.44) }}>
        {initials(name)}
      </T>
    </View>
  );
}

export type AvatarPerson = { name: string; path?: string | null; id?: string };

/** Pile d'avatars avec chevauchement, « +n » au-delà de max. */
export function AvatarPile({ people, max = 5, size = 34 }: { people: AvatarPerson[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <View style={{ flexDirection: 'row' }} accessible accessibilityLabel={`${people.length} membre${people.length > 1 ? 's' : ''} : ${people.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <View key={p.id ?? `${p.name}-${i}`} style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }} importantForAccessibility="no-hide-descendants">
          <UserAvatar name={p.name} path={p.path} size={size} seed={p.id} />
        </View>
      ))}
      {rest > 0 ? (
        <View style={{ marginLeft: -size * 0.3, width: size, height: size, borderRadius: size / 2, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white }}>
          <T v="small" color={colors.white} maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.extraBold }}>
            +{rest}
          </T>
        </View>
      ) : null}
    </View>
  );
}
