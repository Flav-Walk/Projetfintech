import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { coverFor } from '@/lib/covers';
import type { EventRow } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { CoverArtView } from './cover-art';
import { T } from './ui';

/**
 * Famille d'en-têtes COMPLICE (v4).
 * - ScreenHeader : onglets principaux (Accueil, Amis, Activité, Profil). Surtitre + titre + ligne d'état.
 * - EventTabHeader : onglets d'une cagnotte (Idées, Missions, Capsule, Discussion). Une ligne de contexte
 *   (mini-couverture de la cagnotte, son titre, retour à son accueil) porte les actions ; le titre garde toute la largeur.
 * - HeaderAction : bouton rond unique pour retour, aide, réglages, partage (44 px, filet, appui sable).
 * Le détail de marque est contextuel (couverture de la cagnotte, pseudo, compteur), jamais une décoration répétée.
 */

export function HeaderAction({ label, onPress, children, variant = 'paper', hint }: { label: string; onPress: () => void; children: ReactNode; variant?: 'paper' | 'cover'; hint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: colors.sandDeep, borderless: true, radius: 24 }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: variant === 'cover' ? (pressed ? colors.sand : 'rgba(255,255,255,0.94)') : pressed ? colors.sand : 'transparent',
        borderWidth: variant === 'paper' ? 1.5 : 0,
        borderColor: colors.inkLine,
      })}
    >
      {children}
    </Pressable>
  );
}

/** Ligne d'état sous un titre : pastille de couleur facultative (en cours, fait, à faire) et texte court. */
export function HeaderMeta({ text, dot }: { text: string; dot?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 5 }} /> : null}
      <T v="small" color={colors.inkSoft} style={{ flexShrink: 1, fontFamily: fonts.bold }}>
        {text}
      </T>
    </View>
  );
}

export function ScreenHeader({
  title,
  eyebrow,
  meta,
  actions,
  aside,
}: {
  title: string;
  /** Surtitre discret (date, contexte). */
  eyebrow?: string;
  /** Ligne d'état (texte ou nœud). */
  meta?: ReactNode;
  /** Boutons ronds à droite, alignés sur le titre. */
  actions?: ReactNode;
  /** Élément contextuel à droite (avatar). Remplace actions. */
  aside?: ReactNode;
}) {
  return (
    <View style={{ gap: 6, paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? (
            <T v="small" color={colors.coralInk} style={{ fontFamily: fonts.extraBold }} numberOfLines={1}>
              {eyebrow}
            </T>
          ) : null}
          <T v="display" accessibilityRole="header" style={{ fontSize: 32, lineHeight: 36 }}>
            {title}
          </T>
        </View>
        {aside ?? (actions ? <View style={{ flexDirection: 'row', gap: space.sm }}>{actions}</View> : null)}
      </View>
      {typeof meta === 'string' ? <HeaderMeta text={meta} /> : meta}
    </View>
  );
}

/** Mini-couverture de la cagnotte (illustration ou couleur de son occasion). */
function CoverChip({ event }: { event: Pick<EventRow, 'cover_path' | 'cover_art' | 'occasion'> }) {
  const src = coverFor(event);
  const art = src.kind === 'art' ? src.art : src.fallback;
  return (
    <View style={{ width: 30, height: 30, borderRadius: radius.tag, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
      <CoverArtView art={art} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

export function EventTabHeader({
  event,
  title,
  meta,
  actions,
}: {
  event: Pick<EventRow, 'id' | 'title' | 'cover_path' | 'cover_art' | 'occasion'>;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Accueil de la cagnotte ${event.title}`}
          onPress={() => router.navigate(`/event/${event.id}` as never)}
          hitSlop={6}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
        >
          <CoverChip event={event} />
          <T v="label" color={colors.inkSoft} numberOfLines={1} style={{ flexShrink: 1 }}>
            {event.title}
          </T>
        </Pressable>
        {actions ? <View style={{ flexDirection: 'row', gap: space.sm }}>{actions}</View> : null}
      </View>
      <T v="display" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 34 }}>
        {title}
      </T>
      {typeof meta === 'string' ? <HeaderMeta text={meta} /> : meta}
    </View>
  );
}
