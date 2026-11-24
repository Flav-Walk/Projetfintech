import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { EventRow } from '@/lib/types';
import { colors, fonts, space } from '@/theme/tokens';
import { T } from './ui';

/**
 * Famille d'en-têtes COMPLICE (v4).
 * - ScreenHeader : onglets principaux (Accueil, Amis, Activité, Profil). Surtitre + titre + ligne d'état.
 * - EventTabHeader : onglets d'une cagnotte (Idées, Missions, Capsule, Discussion). Une ligne de contexte
 *   (chevron + nom de la cagnotte = retour à son accueil) porte les actions ; le titre garde toute la largeur ;
 *   une perforation de ticket, nouée d'un trait de ruban à la couleur de la page, ferme l'en-tête.
 * - HeaderAction : bouton rond unique pour retour, aide, réglages, partage (44 px, filet, appui sable).
 * Pas de miniature de couverture répétée : le détail de marque vient du ruban et du papier (perforation).
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

/**
 * Séparateur d'en-tête : un nœud de ruban (court trait de couleur) puis une perforation de ticket.
 * La couleur du nœud suit la page (soleil = idées, encre = missions, corail = capsule…), le reste ne change pas.
 */
export function Perforation({ accent = colors.coral }: { accent?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: accent }} />
      <Svg height={2} style={{ flex: 1 }}>
        <Line x1="0" y1="1" x2="100%" y2="1" stroke={colors.inkLine} strokeWidth={1.5} strokeDasharray="3 5" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function EventTabHeader({
  event,
  title,
  meta,
  actions,
  accent,
}: {
  event: Pick<EventRow, 'id' | 'title'>;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  accent?: string;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        {/* Retour vers l'accueil de la cagnotte : chevron + nom de la cagnotte, une seule cible */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Retour à l’accueil de la cagnotte ${event.title}`}
          onPress={() => router.navigate(`/event/${event.id}` as never)}
          hitSlop={6}
          style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.inkLine, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={18} color={colors.ink} strokeWidth={2.4} />
          </View>
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
      <Perforation accent={accent} />
    </View>
  );
}
