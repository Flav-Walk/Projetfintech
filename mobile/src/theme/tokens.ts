/** Jetons COMPLICE. Voir DESIGN.md à la racine du dépôt. */
export const colors = {
  bg: '#FFF7F2',
  surface: '#FFFFFF',
  surfaceSoft: '#FDEEE8',
  border: '#F0E6E0',
  lavender: '#EFEAFF',
  lavenderStrong: '#DCD3FF',
  ink: '#2A1446',
  inkSoft: '#6B5A7E',
  inkFaint: '#A99BB8',
  coral: '#F2553D',
  coralDark: '#D93F28',
  coralSoft: '#FFE1D9',
  violet: '#6A4BF5',
  violetDark: '#5233D6',
  night: '#2B1758',
  sun: '#FFC93C',
  sunSoft: '#FFF1C7',
  mint: '#D7F3E6',
  success: '#1F9D61',
  danger: '#C62F2F',
  dangerSoft: '#FDE7E7',
  white: '#FFFFFF',
} as const;

export const fonts = {
  black: 'Nunito_900Black',
  extraBold: 'Nunito_800ExtraBold',
  bold: 'Nunito_700Bold',
  semiBold: 'Nunito_600SemiBold',
  hand: 'Caveat_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { card: 20, button: 16, field: 14, pill: 999 } as const;
export const gutter = 20;

export const type = {
  display: { fontFamily: fonts.black, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  h1: { fontFamily: fonts.black, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.black, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18 },
  money: { fontFamily: fonts.black, fontSize: 36, lineHeight: 40, fontVariant: ['tabular-nums' as const] },
  hand: { fontFamily: fonts.hand, fontSize: 22, lineHeight: 28 },
} as const;

export const shadow = {
  card: {
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
