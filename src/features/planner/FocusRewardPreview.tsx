import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { FocusCurve } from '@/src/features/planner/FocusCurve';

// ──────────────────────────────────────────────────────────────────────────────
// FocusRewardPreview — the frosted "visible but locked" reward at the top of the
// forming FocusPeakCard. Shows the SHAPE of the activity curve only: the forming
// curve carries no window band, no peak dot, and the clip crops its time axis, so
// nothing about the actual window hours/position leaks (pro-gate leak rule).
//
// MOTION (Task 3): a single, calm opacity fade-in (0→1, motion.base, ease-out) on
// mount — no translate, no scale, no bounce. This is the deliberately safe scope
// for the "reward reveal": the component only ever renders in the forming state,
// so we do NOT try to detect the live personal transition across unmount. Reduced
// motion → rendered at full opacity immediately.
// ──────────────────────────────────────────────────────────────────────────────

export interface FocusRewardPreviewProps {
  scoreByBin: number[];
  caption: string;
}

export function FocusRewardPreview({ scoreByBin, caption }: FocusRewardPreviewProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const appear = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      appear.set(1);
      return;
    }
    appear.set(withTiming(1, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }));
  }, [reduced, appear, t.motion.base]);

  const appearStyle = useAnimatedStyle(() => ({ opacity: appear.get() }));

  // Clip to the SVG plot height so the forming curve's time-axis labels below are
  // cropped away — shape only, no hour values.
  const clip: ViewStyle = {
    height: t.focusCurve.viewH,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceSunken,
  };
  const frost: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const captionStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Animated.View style={[{ gap: t.space[2] }, appearStyle]}>
      <View style={clip}>
        <FocusCurve scoreByBin={scoreByBin} variant="forming" />
        <View style={frost} pointerEvents="none" importantForAccessibility="no" accessibilityElementsHidden>
          <Ionicons name="lock-closed" size={t.iconSize.md} color={t.colors.onIndigo} />
        </View>
      </View>
      <AppText style={captionStyle}>{caption}</AppText>
    </Animated.View>
  );
}
