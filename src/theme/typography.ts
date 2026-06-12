/**
 * Whenbee typography role scale.
 *
 * Text roles → Plus Jakarta Sans (Jakarta-*)
 * Numeric roles → Inter tabular (Inter-*)
 */
export const type = {
  display:   { fontFamily: 'Jakarta-ExtraBold', fontSize: 30, lineHeight: 33, letterSpacing: -0.75 },
  title:     { fontFamily: 'Jakarta-ExtraBold', fontSize: 26, lineHeight: 31, letterSpacing: -0.6 },
  subtitle:  { fontFamily: 'Jakarta-Bold',      fontSize: 22, lineHeight: 27, letterSpacing: -0.2 },
  heading:   { fontFamily: 'Jakarta-Bold',      fontSize: 17, lineHeight: 22 },
  bodyLg:    { fontFamily: 'Jakarta-Bold',      fontSize: 16, lineHeight: 22 },
  body:      { fontFamily: 'Jakarta-Regular',   fontSize: 15, lineHeight: 23 },
  bodySm:    { fontFamily: 'Jakarta-Medium',    fontSize: 14, lineHeight: 20 },
  caption:   { fontFamily: 'Jakarta-Medium',    fontSize: 12.5, lineHeight: 18 },
  micro:     { fontFamily: 'Jakarta-Regular',   fontSize: 11.5, lineHeight: 16 },
  eyebrow:   { fontFamily: 'Jakarta-Bold',      fontSize: 11, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase' as const },
  timerNumeral:   { fontFamily: 'Inter-SemiBold', fontSize: 78, lineHeight: 78, letterSpacing: -2.3, fontVariant: ['tabular-nums'] as const },
  honestNumberXl: { fontFamily: 'Inter-Bold',     fontSize: 40, lineHeight: 42, letterSpacing: -1.0,  fontVariant: ['tabular-nums'] as const },
  bigNumber:      { fontFamily: 'Inter-Bold',     fontSize: 30, lineHeight: 32, letterSpacing: -0.6,  fontVariant: ['tabular-nums'] as const },
  multiplier:     { fontFamily: 'Inter-Bold',     fontSize: 22, lineHeight: 24, letterSpacing: -0.4,  fontVariant: ['tabular-nums'] as const },
} as const;
