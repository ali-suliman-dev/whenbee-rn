import { tokens } from './tokens';
import { useColorMode, type ColorMode } from './useColorMode';
export function resolveTheme(mode: ColorMode) {
  return { mode, colors: tokens.colors[mode], space: tokens.space, radii: tokens.radii,
    borderWidth: tokens.borderWidth, opacity: tokens.opacity,
    fontSize: tokens.fontSize, fontWeight: tokens.fontWeight, fontFamily: tokens.fontFamily,
    lineHeight: tokens.lineHeight, shadow: tokens.shadow, motion: tokens.motion };
}
export type Theme = ReturnType<typeof resolveTheme>;
export function useTheme(): Theme { return resolveTheme(useColorMode()); }
