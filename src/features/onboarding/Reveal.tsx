import type { ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// Reveal — the onboarding entrance primitive. Wraps a section in a soft fade-rise
// (FadeInDown) so a screen assembles top→bottom instead of snapping in flat.
//
// Premium, not bouncy: a plain ease (no springify) over t.motion.slow. Stagger by
// passing an increasing `index` — each step adds t.motion.enterStagger of delay.
// Reduced-motion renders immediately (matches the app-wide `entering ?? undefined`
// gate). Decorative only: it never blocks the CTA, which is tappable on mount.
// ──────────────────────────────────────────────────────────────────────────────

export function Reveal({
  index = 0,
  baseDelay = 0,
  style,
  children,
}: {
  /** Position in the top→bottom cascade — drives the stagger delay. */
  index?: number;
  /** Extra delay before this element's slot (e.g. let a hero settle first). */
  baseDelay?: number;
  style?: ViewStyle;
  children: ReactNode;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  return (
    <Animated.View
      entering={
        reduced
          ? undefined
          : FadeInDown.duration(t.motion.slow).delay(baseDelay + index * t.motion.enterStagger)
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}
