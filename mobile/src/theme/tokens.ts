/**
 * Jetons COMPLICE (v2, 2026-11-22). Voir DESIGN.md à la racine du dépôt.
 * Rôles : corail = argent et action principale ; violet = organisation collective ;
 * aubergine = texte et surfaces sombres ; soleil = célébration ; menthe = accompli.
 */
export const colors = {
  bg: '#FFF8F2',
  surface: '#FFFFFF',
  surfaceSoft: '#FDF0E8',
  sand: '#F6E8DE',
  border: '#EFE2D8',
  lavender: '#EFEAFF',
  lavenderStrong: '#DCD3FF',
  ink: '#2A1446',
  inkSoft: '#655478',
  inkFaint: '#A595B5',
  coral: '#F2553D',
  coralDark: '#D63F27',
  coralSoft: '#FFE3DA',
  /** Corail lisible en texte sur fond clair (contraste ≥ 4,5:1). */
  coralInk: '#B5361F',
  violet: '#6A4BF5',
  violetDark: '#5132D8',
  night: '#251149',
  plum: '#3A1F63',
  sun: '#FFC93C',
  sunSoft: '#FFF1C7',
  sunInk: '#7A5200',
  mint: '#D5F2E3',
  success: '#177E50',
  danger: '#C62F2F',
  dangerSoft: '#FDE7E7',
  white: '#FFFFFF',
  overlay: 'rgba(42, 20, 70, 0.45)',
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

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;
export const radius = { card: 24, button: 18, field: 16, sheet: 28, chip: 12, pill: 999 } as const;
export const gutter = 20;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  h1: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 23 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  overline: { fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  money: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: -1, fontVariant: ['tabular-nums' as const] },
  moneySmall: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums' as const] },
  hand: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 28 },
} as const;

export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  raised: {
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

/** Durées de mouvement (ms). « Réduire les animations » : fondu court ou rien. */
export const motion = { fast: 150, base: 220, slow: 320, celebrate: 600 } as const;

/** Teintes d'avatar sans photo (pastels de la palette). */
export const avatarTints = ['#FFD8CC', '#DCD3FF', '#FFF1C7', '#D5F2E3', '#FFE1EC', '#D6ECFF'] as const;
