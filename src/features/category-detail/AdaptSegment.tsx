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
import type { AdaptSpeed } from '@/src/domain/types';
import { AdaptGlyph } from './AdaptGlyph';

// ──────────────────────────────────────────────────────────────────────────────
// AdaptSegment — "Tune how I learn": Steady | Balanced | Reactive.
//
// Maps to the engine's EWMA α (steady=slow, balanced=default, reactive=fast). A
// slim capsule segmented control on the bare page: the lighter `surface` track
// gives it containment (no border), an indigo-tinted pill glides under the active
// option with a soft glow, and each option carries an AdaptGlyph that conveys its
// character. The hint explains the chosen mode.
// No guilt, no red — this is a "you're in control" lever (Nielsen #3).
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: { value: AdaptSpeed; label: string }[] = [
  { value: 'steady', label: 'Steady' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'reactive', label: 'Reactive' },
];

// Hints as colored runs: `em` words read in the high-contrast ink (brighter on
// dark, darker on light), the rest in inkSoft — so each line is scannable.
type HintRun = { t: string; em?: boolean };

const HINTS: Record<AdaptSpeed, HintRun[]> = {
  steady: [
    { t: 'Slow to change', em: true },
    { t: '. It leans on your ' },
    { t: 'whole history', em: true },
    { t: ', so it fits when your pace stays ' },
    { t: 'consistent', em: true },
    { t: '.' },
  ],
  balanced: [
    { t: 'The everyday setting. A ' },
    { t: 'fair mix', em: true },
    { t: ' of your history and your ' },
    { t: 'recent runs', em: true },
    { t: '.' },
  ],
  reactive: [
    { t: 'Catches up fast', em: true },
    { t: ' when your pace ' },
    { t: 'changes', em: true },
    { t: ', like after new meds, a rough night, or a new routine.' },
  ],
};

const PAD = 4; // inner track padding (= space[1]); the pill insets by this much

interface AdaptSegmentProps {
  value: AdaptSpeed;
  onChange: (speed: AdaptSpeed) => void;
}

export function AdaptSegment({ value, onChange }: AdaptSegmentProps) {
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

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const hint: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const hintEm: TextStyle = { color: t.colors.ink };

  const track: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.full,
    padding: PAD,
  };
  // Indigo-tinted lifted pill + a soft indigo glow (Platform shadow, never a
  // border or CSS boxShadow). Sized to one segment, slid by the worklet above.
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[1.5],
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
    <View style={{ gap: t.space[4] }}>
      <Text style={header}>Tune how I learn</Text>

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
              accessibilityLabel={`${opt.label} learning mode`}
              style={segment}
            >
              <AdaptGlyph kind={opt.value} active={selected} />
              <Text style={labelStyle(selected)} numberOfLines={1}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={hint}>
        {HINTS[value].map((run, i) => (
          <Text key={i} style={run.em ? hintEm : undefined}>
            {run.t}
          </Text>
        ))}
      </Text>
    </View>
  );
}
