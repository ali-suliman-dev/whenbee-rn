import { useCallback } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
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

  useAmbientMotion(
    state === 'now' && !reducedMotion,
    useCallback(() => {
      cancelAnimation(haloScale);
      haloScale.set(
        withRepeat(
          withTiming(1.6, { duration: t.motion.halo, easing: Easing.inOut(Easing.sin) }),
          -1,
          true,
        ),
      );
      return () => {
        cancelAnimation(haloScale);
        haloScale.set(1);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, reducedMotion]),
  );

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
    // Footprint is exactly nodeSize (like every other node) so the gutter can centre
    // it without drift; the halo is absolute and inset symmetrically so it expands
    // EQUALLY in all directions instead of overflowing one corner.
    const core = nodeSize - 2; // filled disc — a touch smaller than the hollow ring
    const dotSize = t.planRail.nowDot - 1;
    const haloSize = core + ringExpand * 2;
    const haloInset = (nodeSize - haloSize) / 2;
    const haloBase: ViewStyle = {
      position: 'absolute',
      top: haloInset,
      left: haloInset,
      width: haloSize,
      height: haloSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.primarySoft,
    };
    const nodeStyle: ViewStyle = {
      width: core,
      height: core,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    };
    const dotStyle: ViewStyle = {
      width: dotSize,
      height: dotSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.onIndigo,
    };
    return (
      <View style={{ width: nodeSize, height: nodeSize, justifyContent: 'center', alignItems: 'center' }}>
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
