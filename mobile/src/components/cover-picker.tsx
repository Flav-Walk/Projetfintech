import { Check, ImagePlus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { COVER_ARTS, COVER_LABELS, type CoverArt } from '@/lib/covers';
import { hapticTap } from '@/lib/haptics';
import { pickImage, type PickedImage } from '@/lib/media';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { CoverArtView } from './cover-art';
import { EventCover } from './event-cover';
import { T } from './ui';

/** Choix courant : une illustration COMPLICE, une nouvelle photo choisie, ou la photo déjà en place. */
export type CoverChoice = { kind: 'art'; art: CoverArt } | { kind: 'photo'; picked: PickedImage } | { kind: 'current'; path: string; art: CoverArt };

/**
 * Couverture : aperçu en grand (cadrage réel 16:9 des cartes), puis deux voies —
 * une photo de la galerie (recadrée en 16:9) ou une illustration de la bibliothèque COMPLICE.
 */
export function CoverPicker({ value, onChange, occasion, onError }: { value: CoverChoice; onChange: (c: CoverChoice) => void; occasion: string; onError?: (m: string) => void }) {
  const art = value.kind === 'photo' ? undefined : value.art;
  const preview = {
    cover_path: value.kind === 'current' ? value.path : null,
    cover_art: value.kind === 'photo' ? null : value.art,
    occasion,
  };
  async function choosePhoto() {
    try {
      const img = await pickImage([16, 9]);
      if (img) onChange({ kind: 'photo', picked: img });
    } catch {
      onError?.('Impossible d’ouvrir la galerie.');
    }
  }
  return (
    <View style={{ gap: space.md }}>
      <View>
        <EventCover event={preview} localUri={value.kind === 'photo' ? value.picked.uri : null} art={art} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.cover }} />
        <View style={{ position: 'absolute', left: space.md, bottom: space.md, backgroundColor: colors.white, borderRadius: radius.tag, paddingHorizontal: 8, paddingVertical: 3 }}>
          <T v="small" style={{ fontFamily: fonts.bold }}>
            Aperçu
          </T>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir une photo dans la galerie"
        onPress={choosePhoto}
        android_ripple={{ color: colors.sand }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.field, borderWidth: 1.5, borderColor: value.kind === 'photo' || value.kind === 'current' ? colors.ink : colors.border, backgroundColor: pressed ? colors.sand : colors.surface })}
      >
        <ImagePlus size={20} color={colors.ink} />
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Choisir une photo dans la galerie</T>
          <T v="small" color={colors.inkSoft}>
            Recadrée au format de la carte, visible du groupe seulement.
          </T>
        </View>
        {value.kind !== 'art' ? <Check size={20} color={colors.ink} strokeWidth={2.5} /> : null}
      </Pressable>
      <T v="label">Ou une illustration COMPLICE</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup">
        {COVER_ARTS.map((a) => {
          const selected = value.kind === 'art' && value.art === a;
          return (
            <Pressable
              key={a}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Illustration ${COVER_LABELS[a]}`}
              onPress={() => {
                hapticTap();
                onChange({ kind: 'art', art: a });
              }}
              style={{ width: '31.5%', gap: 4 }}
            >
              <View style={{ borderRadius: radius.field, borderWidth: 3, borderColor: selected ? colors.ink : 'transparent', overflow: 'hidden' }}>
                <CoverArtView art={a} style={{ width: '100%', aspectRatio: 16 / 9 }} />
              </View>
              <T v="small" numberOfLines={1} color={selected ? colors.ink : colors.inkSoft} style={{ fontFamily: selected ? fonts.bold : fonts.semiBold }}>
                {COVER_LABELS[a]}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
