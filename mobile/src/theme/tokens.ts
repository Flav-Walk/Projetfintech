/**
 * Jetons COMPLICE v3 « papier, ruban et tampon » (2026-11-23). Voir DESIGN.md.
 * Rôles : papier = fond (60 %) ; aubergine = texte et surfaces fortes (30 %) ; corail = argent et action
 * principale, soleil = célébration, violet = organisation collective (10 % d'accents, jamais en aplats répétés).
 */
export const colors = {
  bg: '#FBF5EE',
  surface: '#FFFFFF',
  surfaceSoft: '#F7EDE3',
  sand: '#F1E5D8',
  border: '#E9DCCE',
  lavender: '#EEE9FF',
  lavenderStrong: '#D9D0FF',
  ink: '#24123D',
  inkSoft: '#5E4E72',
  inkFaint: '#9C8EAE',
  coral: '#EF4E36',
  coralDark: '#D23A22',
  coralSoft: '#FFE2D8',
  /** Corail lisible en texte sur fond clair (contraste ≥ 4,5:1). */
  coralInk: '#B0331C',
  violet: '#5B3FE0',
  violetDark: '#4529C4',
  night: '#21103D',
  plum: '#3A1F63',
  sun: '#FFC23D',
  sunSoft: '#FFF0C9',
  sunInk: '#6E4A00',
  mint: '#D6F1E4',
  success: '#167A4D',
  danger: '#C02B2B',
  dangerSoft: '#FCE6E6',
  white: '#FFFFFF',
  overlay: 'rgba(36, 18, 61, 0.48)',
  /** Voile de lisibilité sur une couverture (texte blanc par-dessus). */
  scrim: 'rgba(23, 10, 44, 0.55)',
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
export const avatarTints = ['#FFD6C8', '#D9D0FF', '#FFF0C9', '#D6F1E4', '#FFDDEA', '#D4E9FF'] as const;
