import { useEffect, useRef, useState } from 'react';
import { View, Pressable, Text, type LayoutChangeEvent, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PlanSegment — the Plan-tab header segmented control: Today · Routines.
//
// `Today` is the existing free Start-By flow; `Routines` is the Pro surface. The
// active segment carries the screen's one indigo (the gliding pill = primaryChip),
// per the 60-30-10 rule. Both segments are always visible so the value is
// discoverable; gating is the content's job, not this control's.
//
// Mirrors AdaptSegment's slide physics (strong ease-out, no spring bounce). The
// pill snaps on first measure, then animates on every change.
// ──────────────────────────────────────────────────────────────────────────────

export type PlanTab = 'today' | 'routines';

const OPTIONS: { value: PlanTab; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'routines', label: 'Routines' },
];

const PAD = 4; // inner track padding (= space[1]); the pill insets by this much

export function PlanSegment({ value, onChange }: { value: PlanTab; onChange: (tab: PlanTab) => void }) {
  const t = useTheme();
  const index = Math.max(0, OPTIONS.findIndex((o) => o.value === value));

  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - PAD * 2) / OPTIONS.length : 0;

  const tx = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (segW <= 0) return;
    const target = PAD + index * segW;
    if (!placed.current) {
      tx.set(target);
      placed.current = true;
    } else {
      tx.set(withTiming(target, { duration: t.motion.base, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    }
  }, [index, segW, tx, t.motion.base]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));

  const track: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.full,
    padding: PAD,
  };
  const pill: ViewStyle = {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    width: segW,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primaryChip,
  };
  const segment: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.space[2.5],
  };

  function labelStyle(selected: boolean): TextStyle {
    return { ...(type.captionBold as unknown as TextStyle), color: selected ? t.colors.ink : t.colors.inkSoft };
  }

  function onLayout(e: LayoutChangeEvent) {
    setTrackW(e.nativeEvent.layout.width);
  }

  return (
    <View style={track} onLayout={onLayout} accessibilityRole="tablist">
      {segW > 0 ? <Animated.View pointerEvents="none" style={[pill, pillStyle]} /> : null}
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${opt.label} plan`}
            style={segment}
          >
            <Text style={labelStyle(selected)} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
