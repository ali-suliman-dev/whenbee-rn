import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  type LayoutChangeEvent,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PatternsSegment — 3-option tab control for the Patterns IA.
//
// Options: Numbers | Insights | Correlations. A gliding indigo-tinted pill
// tracks the active option (strong ease-out, no spring/bounce), mirroring the
// AdaptSegment physics exactly so the two controls feel like one design system.
//
// Props:
//   value    — the controlled active tab
//   onChange — called with the new tab when a user taps a different option
//
// a11y: the track carries role="tablist"; each Pressable is an implicit button
// with accessibilityState.selected so VoiceOver reads the current selection.
// ──────────────────────────────────────────────────────────────────────────────

/** The three Patterns tabs. */
export type PatternsTab = 'numbers' | 'insights' | 'correlations';

const OPTIONS: { value: PatternsTab; label: string }[] = [
  { value: 'numbers', label: 'Numbers' },
  { value: 'insights', label: 'Insights' },
  { value: 'correlations', label: 'Correlations' },
];

const PAD = 4; // inner track padding (= space[1]); the pill insets by this much

interface PatternsSegmentProps {
  value: PatternsTab;
  onChange: (tab: PatternsTab) => void;
}

export function PatternsSegment({ value, onChange }: PatternsSegmentProps) {
  const t = useTheme();
  const index = Math.max(0, OPTIONS.findIndex((o) => o.value === value));

  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? (trackW - PAD * 2) / OPTIONS.length : 0;

  // The selected pill glides between segments. Snap into place on first measure,
  // then a smooth strong ease-out on every change — no spring overshoot/bounce.
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

  // Indigo-tinted lifted pill + a soft indigo glow. Sized to one segment, slid
  // by the worklet above. No CSS boxShadow — View-based shadows only.
  const pill: ViewStyle = {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    width: segW,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.primaryChip,
    ...Platform.select({
      ios: {
        shadowColor: t.colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  };

  const segment: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.space[2.5],
  };

  function labelStyle(selected: boolean): TextStyle {
    return {
      ...(type.captionBold as unknown as TextStyle),
      color: selected ? t.colors.ink : t.colors.inkSoft,
    };
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
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
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
