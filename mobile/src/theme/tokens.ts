/**
 * Jetons COMPLICE v4 « papier, ruban et tampon » (2026-11-24). Voir DESIGN.md.
 * Rôles : papier et tons chauds = surfaces (60 %) ; aubergine = texte, sélection, navigation (30 %) ;
 * corail = argent et action principale, soleil = repère actif et célébration (10 %) ; nuit = capsule seulement.
 * Le violet électrique et les fonds lavande de la v3 sont retirés : ils n'appartenaient pas à cette famille.
 */
export const colors = {
  bg: '#FBF5EE',
  surface: '#FFFFFF',
  surfaceSoft: '#F7EDE3',
  sand: '#F1E5D8',
  /** Sable appuyé : état pressé, piste de progression. */
  sandDeep: '#E6D5C3',
  border: '#E9DCCE',
  ink: '#24123D',
  inkSoft: '#5E4E72',
  /** Texte tertiaire, icônes inactives, indications : 4,7:1 sur papier. */
  inkFaint: '#7B697D',
  /** Filets et pointillés décoratifs (jamais pour du texte). */
  inkLine: '#CDBFC3',
  coral: '#EF4E36',
  /** Fond des boutons principaux : 4,8:1 avec le texte blanc. */
  coralDark: '#D23A22',
  coralPressed: '#B52F1A',
  coralSoft: '#FFE2D8',
  /** Corail lisible en texte sur fond clair (contraste ≥ 4,5:1). */
  coralInk: '#B0331C',
  night: '#21103D',
  plum: '#3A1F63',
  /** Texte secondaire sur fond nuit ou aubergine (12:1). */
  nightSub: '#E8D9D2',
  /** Rose papier : décor d'illustration sur fond sombre ou corail. */
  blush: '#F6C9BC',
  sun: '#FFC23D',
  sunSoft: '#FFF0C9',
  sunInk: '#6E4A00',
  mint: '#D6F1E4',
  success: '#167A4D',
  danger: '#C02B2B',
  dangerSoft: '#FCE6E6',
  white: '#FFFFFF',
  /** Voile des feuilles : aubergine très dilué, chaud (pas de mauve). */
  overlay: 'rgba(33, 16, 32, 0.42)',
  /** Voile de lisibilité sur une couverture (texte blanc par-dessus). */
  scrim: 'rgba(23, 10, 30, 0.55)',
} as const;

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  black: 'Nunito_900Black',
  extraBold: 'Nunito_800ExtraBold',
  bold: 'Nunito_700Bold',
  semiBold: 'Nunito_600SemiBold',
  hand: 'Caveat_600SemiBold',
} as const;

/** Grille de 4/8. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
/** Rayons selon la fonction : étiquette 8, champ 14, bloc 18, couverture 22, feuille 28, pilule. */
export const radius = { tag: 8, chip: 12, field: 14, card: 18, cover: 22, button: 999, sheet: 28, pill: 999 } as const;
export const gutter = 20;

/** Cinq tailles : 34 / 24 / 19 / 16 / 13 (+ chiffres d'argent). Deux familles : Bricolage (titres, chiffres), Nunito (texte). */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 21, letterSpacing: -0.1 },
  body: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  overline: { fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  money: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums' as const] },
  moneySmall: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 23, fontVariant: ['tabular-nums' as const] },
  hand: { fontFamily: fonts.hand, fontSize: 24, lineHeight: 30 },
} as const;

export const shadow = {
  /** Réservée aux éléments flottants (barre d'onglets, bouton « + », feuilles, toasts). */
  card: {
    shadowColor: '#3A1F63',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  raised: {
    shadowColor: '#3A1F63',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  none: {},
} as const;

/** Durées de mouvement (ms). « Réduire les animations » : fondu court ou rien. */
export const motion = { fast: 150, base: 220, slow: 320, celebrate: 600 } as const;

/** Teintes d'avatar sans photo (pastels de la palette). */
export const avatarTints = ['#FFD6C8', '#F3E2C7', '#FFF0C9', '#D6F1E4', '#FFDDEA', '#EADBD3'] as const;

/**
 * Familles d'icônes par rôle (pastille + trait). Une même famille partout : journal, activité, préparatifs.
 * argent = corail ; fête et échéance = soleil ; groupe et organisation = sable/aubergine ; fait = menthe ;
 * capsule = nuit/soleil.
 */
export const tints = {
  money: { bg: '#FFE2D8', fg: '#B0331C' },
  sun: { bg: '#FFF0C9', fg: '#6E4A00' },
  group: { bg: '#F1E5D8', fg: '#24123D' },
  done: { bg: '#D6F1E4', fg: '#167A4D' },
  capsule: { bg: '#21103D', fg: '#FFC23D' },
} as const;
export type Tint = keyof typeof tints;
