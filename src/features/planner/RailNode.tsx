import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';

// ──────────────────────────────────────────────────────────────────────────────
// RailNode — the circular status indicator in the Run plan rail.
//
// States:
//   done     — green fill + ✓ check glyph
//   now      — purple fill + white center dot + pulsing halo ring (2.2s calm)
//   next     — hollow ring (hairline border)
//   breather — small coffee-cup node (☕), dimmed
//
// The "now" pill label lives here too so the gutter column owns the full
// vertical stack: [now pill → node] or [time → node].
//
// Pulse approach: withRepeat(withTiming) drives a scale-based halo ring layered
// behind the filled node. Reduced-motion → static ring, no animation.
// ──────────────────────────────────────────────────────────────────────────────

export type RailNodeState = 'done' | 'now' | 'next' | 'breather';

export interface RailNodeProps {
  state: RailNodeState;
}

export function RailNode({ state }: RailNodeProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // Halo scale: 1 → 1.6 → 1 over 2.2s (matches t.motion.halo = 2200).
  // Only runs for `now`; shared-value creation is unconditional per Rules of Hooks.
  const haloScale = useSharedValue(1);

  const nodeSize = t.planRail.node; // 20pt
  const breatherSize = t.planRail.breatherNode; // 16pt
  const ringExpand = t.planRail.nowRing; // 3pt — how far the ring sits outside the node

  // Start the pulse for `now` state
  if (state === 'now' && !reducedMotion) {
    // Runs the first render and re-runs each time state changes to `now`.
    // Using `cancelAnimation` is not needed here — withRepeat handles its own loop.
    haloScale.set(
      withRepeat(
        withTiming(1.6, {
          duration: t.motion.halo,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true, // reverse: scale back down
      ),
    );
  } else if (state !== 'now') {
    haloScale.set(1);
  }

  const haloAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.get() }],
  }));

  if (state === 'breather') {
    const size = breatherSize;
    const containerStyle: ViewStyle = {
      width: size,
      height: size,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.surfaceSunken,
      justifyContent: 'center',
      alignItems: 'center',
    };
    const emojiStyle: TextStyle = {
      fontSize: t.fontSize.xs,
      lineHeight: size,
      textAlign: 'center',
    };
    return (
      <View style={containerStyle}>
        <AppText style={emojiStyle}>☕</AppText>
      </View>
    );
  }

  if (state === 'done') {
    const nodeStyle: ViewStyle = {
      width: nodeSize,
      height: nodeSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.success,
      justifyContent: 'center',
      alignItems: 'center',
    };
    const checkStyle: TextStyle = {
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
      color: t.colors.successSoft,
      lineHeight: nodeSize,
      textAlign: 'center',
    };
    return (
      <View style={nodeStyle}>
        <AppText style={checkStyle}>✓</AppText>
      </View>
    );
  }

  if (state === 'now') {
    // Halo ring sits behind the filled node — rendered as a scaled Animated.View
    const haloSize = nodeSize + ringExpand * 2;
    const haloBase: ViewStyle = {
      position: 'absolute',
      width: haloSize,
      height: haloSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.primarySoft,
    };
    const nodeStyle: ViewStyle = {
      width: nodeSize,
      height: nodeSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    };
    const dotStyle: ViewStyle = {
      width: 7,
      height: 7,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.onIndigo,
    };
    return (
      <View style={{ width: haloSize, height: haloSize, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={[haloBase, reducedMotion ? undefined : haloAnimStyle]} />
        <View style={nodeStyle}>
          <View style={dotStyle} />
        </View>
      </View>
    );
  }

  // state === 'next'
  const nextNodeStyle: ViewStyle = {
    width: nodeSize,
    height: nodeSize,
    borderRadius: t.radii.full,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    backgroundColor: t.colors.bg,
  };
  return <View style={nextNodeStyle} />;
}
