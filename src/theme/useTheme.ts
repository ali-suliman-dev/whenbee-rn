import { tokens } from './tokens';
import { useColorMode, type ColorMode } from './useColorMode';
export function resolveTheme(mode: ColorMode) {
  return { mode, colors: tokens.colors[mode], space: tokens.space, radii: tokens.radii,
    borderWidth: tokens.borderWidth, opacity: tokens.opacity, gradients: tokens.gradients, scale: tokens.scale, depth: tokens.depth, size: tokens.size, iconSize: tokens.iconSize,
    fontSize: tokens.fontSize, fontWeight: tokens.fontWeight, fontFamily: tokens.fontFamily,
    lineHeight: tokens.lineHeight, letterSpacing: tokens.letterSpacing, shadow: tokens.shadow, motion: tokens.motion,
    honeycomb: tokens.honeycomb, brand: tokens.brand, burst: tokens.burst, progress: tokens.progress,
    companion: tokens.companion, ring: tokens.ring, headerRing: tokens.headerRing, seal: tokens.seal, mote: tokens.mote, row: tokens.row, planRail: tokens.planRail, upsell: tokens.upsell, quick: tokens.quick, chart: tokens.chart, proTeaser: tokens.proTeaser, discovery: tokens.discovery };
}
export type Theme = ReturnType<typeof resolveTheme>;
export function useTheme(): Theme { return resolveTheme(useColorMode()); }
