import { useEffect, useRef, useState } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { analytics } from '@/src/services/analytics';
import { ReasonGlyph, type ReasonGlyphKind } from './ReasonGlyph';
import type { RunDirection } from './useReward';

// ──────────────────────────────────────────────────────────────────────────────
// ReasonChips — an OPTIONAL, capture-only "where'd the time go?" row in Reward.
//
// Shown AFTER the deposit beat, ONLY when the run diverged from the guess past
// the gate (useReward owns that decision; this renders nothing without a
// direction). It is pure side-channel data for a future Pro "what steals your
// time" read — it NEVER touches the multiplier, honey, or Reclaim.
//
// Curiosity, never blame: the copy asks where the time went, it doesn't say the
// user failed. Tapping a chip tags the event and marks the chip selected; both
// exits stay open — choosing is skippable, and leaving without a pick is fine.
// ──────────────────────────────────────────────────────────────────────────────

interface ReasonOption {
  /** Stable analytics/storage value — never localized. */
  value: string;
  /** What the user reads. */
  label: string;
  /** A refined leading illustration — turns a gray pill into something fun to tap. */
  glyph: ReasonGlyphKind;
}

const OVER_HEADER = 'Where did the time go?';
const UNDER_HEADER = 'What made it quick?';
// Warm, honest closure after a tap — no overclaim (the tag is side-channel data),
// no blame. Just acknowledges the note landed.
const CONFIRM_HEADER = 'Good to know.';

// Neutral, kind framings. Over-run owns the "took longer" reasons; under-run the
// "went faster" ones. No "you got distracted / you failed" — only curiosity. A
// leading illustration makes each one scannable and inviting to press.
const OVER_OPTIONS: readonly ReasonOption[] = [
  { value: 'interrupted', label: 'Paused', glyph: 'interrupted' },
  { value: 'underestimated', label: 'Grew', glyph: 'bigger' },
  { value: 'context_switch', label: 'Pulled', glyph: 'pulled' },
];
const UNDER_OPTIONS: readonly ReasonOption[] = [
  { value: 'focused', label: 'Flow', glyph: 'zone' },
  { value: 'overestimated', label: 'Fast', glyph: 'smaller' },
];

// Chips land after the payoff card's reveal (t.motion.draw), then ping in
// one-by-one with this per-chip stagger.
const ENTER_STAGGER = 70;

export function ReasonChips({
  eventId,
  direction,
  category,
}: {
  eventId: string;
  direction: RunDirection;
  category: string;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const setReason = useCalibrationStore((s) => s.setReason);

  const header = direction === 'over' ? OVER_HEADER : UNDER_HEADER;
  const options = direction === 'over' ? OVER_OPTIONS : UNDER_OPTIONS;

  const [selected, setSelected] = useState<string | null>(null);

  // Funnel: fire `shown` once when the row appears, and `skipped` on unmount only
  // when the user left without tagging. A ref tracks the latest selection so the
  // cleanup reads the final value, not a stale closure capture.
  const taggedRef = useRef(false);
  useEffect(() => {
    analytics.capture('overrun_reason_shown', { category, direction });
    return () => {
      if (!taggedRef.current) {
        analytics.capture('overrun_reason_skipped', { category, direction });
      }
    };
  }, [category, direction]);

  function handleSelect(value: string) {
    taggedRef.current = true;
    setSelected(value);
    void setReason(eventId, value, 'manual');
    analytics.capture('overrun_reason_tagged', {
      category,
      direction,
      reason: value,
      source: 'manual',
    });
  }

  const wrap: ViewStyle = { gap: t.space[2.5] };
  const prompt: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: selected ? t.colors.accent : t.colors.inkSoft,
  };
  const chipRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[2],
    width: '100%',
  };
  // Light indigo pill in light mode so the leading glyph reads against it; the
  // plain surface well in dark mode reads fine already.
  const chipContainer: ViewStyle = {
    backgroundColor: t.mode === 'light' ? t.colors.primaryWash : t.colors.surface,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1.5],
    flex: 1,
    justifyContent: 'center',
  };
  // Header swaps to a warm confirm once a reason is tagged — closure on the tap.
  const headerText = selected ? CONFIRM_HEADER : header;

  return (
    <View style={wrap}>
      <Animated.Text
        key={headerText}
        entering={reducedMotion ? undefined : FadeIn.duration(t.motion.base)}
        style={prompt}
      >
        {headerText}
      </Animated.Text>
      <View style={chipRow}>
        {options.map((opt, i) => (
          <Animated.View
            key={opt.value}
            style={{ flex: 1 }}
            entering={
              reducedMotion
                ? undefined
                : FadeInDown.duration(t.motion.base)
                    .delay(t.motion.draw + i * ENTER_STAGGER)
                    .springify()
                    .damping(t.motion.spring.damping)
                    .stiffness(t.motion.spring.stiffness)
            }
          >
            <Chip
              label={opt.label}
              icon={<ReasonGlyph kind={opt.glyph} active={selected === opt.value} />}
              selected={selected === opt.value}
              style={{ flex: 1 }}
              containerStyle={chipContainer}
              onPress={() => handleSelect(opt.value)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
