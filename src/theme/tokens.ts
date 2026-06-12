// The ONE place to change the look of the app. space/radii/fontSize are RN points (numbers).
export const tokens = {
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radii: { none: 0, sm: 6, md: 10, lg: 16, xl: 24, pill: 999 },
  fontSize: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, '2xl': 30, '3xl': 38 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  fontFamily: { ui: 'System', mono: 'Menlo' },
  lineHeight: { tight: 1.15, normal: 1.4, relaxed: 1.6 },
  shadow: { sm: { offset: 2, opacity: 0.12, radius: 4 }, md: { offset: 4, opacity: 0.14, radius: 8 } },
  motion: { fast: 120, base: 220, slow: 360 },
  colors: {
    light: { bg: '#F7F6F2', surface: '#FFFFFF', text: '#15171C', textMuted: '#6B7180',
      primary: '#5B5BD6', primaryText: '#FFFFFF', accent: '#E8A13A', success: '#2FA37A',
      danger: '#D14343', border: '#E6E3DC' },
    dark: { bg: '#0E1014', surface: '#171A20', text: '#F2F3F5', textMuted: '#9097A3',
      primary: '#7C7CF0', primaryText: '#0E1014', accent: '#E8A13A', success: '#3FB98C',
      danger: '#E06464', border: '#262A32' },
  },
} as const;
export type ColorName = keyof typeof tokens.colors.light;
export type SpaceName = keyof typeof tokens.space;
