import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// TabIcon — custom, smooth-edged tab glyphs that *draw themselves on* when focused.
//
// Two stacked stroke layers in a 24×24 viewBox:
//   • base   — the resting glyph, muted (inkSoft). Fully visible when blurred; it
//              FADES OUT as the tab gains focus so the draw plays on a clean slate.
//   • accent — the same subpaths in indigo (primary), revealed via stroke-dashoffset.
//              focusProgress 0→1 slides each dash into view — the calming draw-on;
//              0 leaves it fully hidden, so no indigo leaks on an inactive tab.
//
// Net effect on tap: the grey icon dissolves and the indigo one redraws itself
// stroke-by-stroke — the line indicator already marks the tab, so the icon's job
// here is the small moment of delight, not redundant state.
//
// RN has no SMIL / getTotalLength, so each subpath's drawn length is hardcoded and
// the offset is driven on the UI thread via useAnimatedProps (the TimerRing pattern).
// Reduced motion is handled by the parent — it sets focusProgress instantly, so the
// accent snaps to full (active) or hidden (inactive) and the base flips with it.
// ──────────────────────────────────────────────────────────────────────────────

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

const STROKE = 2;
// The grey base clears out early (first ~18%) so the indigo stroke draws on an
// empty slate for the rest — the draw, not a recolour, is what the eye follows.
const BASE_FADE: [number, number] = [0, 0.18];

export type TabIconName = 'home' | 'calendar' | 'bee' | 'pulse';

type Sub = {
  d: string;
  // Drawn length of the subpath — slightly over-estimate is safe (fully hides at
  // offset = len). Tuned by eye so the accent fills exactly by focus end.
  len: number;
  // Optional reveal window over focusProgress for a layered stagger.
  window?: [number, number];
};

const ICON_PATHS: Record<TabIconName, Sub[]> = {
  home: [
    { d: 'M3.5 11.5 L12 4.5 L20.5 11.5', len: 24 },
    {
      d: 'M5.5 10.5 V18.5 a1.2 1.2 0 0 0 1.2 1.2 H17.3 a1.2 1.2 0 0 0 1.2-1.2 V10.5',
      len: 36,
    },
  ],
  calendar: [
    {
      d: 'M5 6.5 h14 a1.5 1.5 0 0 1 1.5 1.5 V18 a1.5 1.5 0 0 1-1.5 1.5 H5 a1.5 1.5 0 0 1-1.5-1.5 V8 a1.5 1.5 0 0 1 1.5-1.5 Z',
      len: 50,
    },
    { d: 'M3.5 10 H20.5', len: 17 },
    { d: 'M8 4.5 V7', len: 3 },
    { d: 'M16 4.5 V7', len: 3 },
  ],
  // Honeycomb-bee: a wide V of antennae, an oval striped body, two swept wings.
  // Drawn in two waves — the body first, then the lighter details.
  bee: [
    // Body — elongated oval (thorax + abdomen, antennae spring from its crown).
    { d: 'M8.4 13.5 a3.6 5 0 1 0 7.2 0 a3.6 5 0 1 0 -7.2 0 Z', len: 27, window: [0.12, 0.55] },
    // Antennae — splay up-and-out in a wide V; round caps are the knobbed tips.
    { d: 'M11.2 8.8 Q9.1 6 8.6 3.9', len: 6, window: [0.45, 1] },
    { d: 'M12.8 8.8 Q14.9 6 15.4 3.9', len: 6, window: [0.45, 1] },
    // Wings — swept teardrops whose tips lift up-and-out from the shoulders.
    { d: 'M9.6 11.6 C5.9 8 3.8 9.2 4.7 11.8 C5.3 13.5 7.9 13.4 9.6 11.6 Z', len: 16, window: [0.45, 1] },
    { d: 'M14.4 11.6 C18.1 8 20.2 9.2 19.3 11.8 C18.7 13.5 16.1 13.4 14.4 11.6 Z', len: 16, window: [0.45, 1] },
    // Abdomen stripes.
    { d: 'M9.1 13.7 Q12 14.5 14.9 13.7', len: 7, window: [0.45, 1] },
    { d: 'M9.6 16.3 Q12 17 14.4 16.3', len: 6, window: [0.45, 1] },
  ],
  // Heartbeat / ECG — flat lead-in, a QRS spike, flat lead-out.
  pulse: [{ d: 'M3 12.5 H7.5 L9.2 8.5 L11.2 16.5 L13.2 7 L14.8 12.5 H21', len: 40 }],
};

function AccentPath({
  d,
  len,
  window,
  focusProgress,
  color,
}: {
  d: string;
  len: number;
  window: [number, number];
  focusProgress: SharedValue<number>;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const local = interpolate(focusProgress.get(), window, [0, 1], Extrapolation.CLAMP);
    return { strokeDashoffset: len * (1 - local) };
  });

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={len}
      animatedProps={animatedProps}
    />
  );
}

export function TabIcon({
  icon,
  focusProgress,
  size = 24,
}: {
  icon: TabIconName;
  focusProgress: SharedValue<number>;
  size?: number;
}) {
  const t = useTheme();
  const subs = ICON_PATHS[icon];

  // Base dissolves as the tab focuses; reappears as it blurs.
  const baseProps = useAnimatedProps(() => ({
    opacity: interpolate(focusProgress.get(), BASE_FADE, [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Base layer — the resting glyph, fades out on focus. */}
      <AnimatedG animatedProps={baseProps}>
        {subs.map((s, i) => (
          <Path
            key={`base-${i}`}
            d={s.d}
            fill="none"
            stroke={t.colors.inkSoft}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </AnimatedG>
      {/* Accent layer — indigo, drawn on by focusProgress. */}
      {subs.map((s, i) => (
        <AccentPath
          key={`accent-${i}`}
          d={s.d}
          len={s.len}
          window={s.window ?? [0.12, 1]}
          focusProgress={focusProgress}
          color={t.colors.primary}
        />
      ))}
    </Svg>
  );
}
