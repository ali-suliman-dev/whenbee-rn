import { useEffect, useRef, useState } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { analytics } from '@/src/services/analytics';
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
}

const OVER_HEADER = 'Where did the time go?';
const UNDER_HEADER = 'What made it quick?';

// Neutral, kind framings. Over-run owns the "took longer" reasons; under-run the
// "went faster" ones. No "you got distracted / you failed" — only curiosity.
const OVER_OPTIONS: readonly ReasonOption[] = [
  { value: 'interrupted', label: 'Got interrupted' },
  { value: 'underestimated', label: 'Bigger than it looked' },
  { value: 'context_switch', label: 'Pulled away' },
];
const UNDER_OPTIONS: readonly ReasonOption[] = [
  { value: 'focused', label: 'In the zone' },
  { value: 'overestimated', label: 'Smaller than it looked' },
];

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

  const wrap: ViewStyle = { gap: t.space[2], alignItems: 'center' };
  const prompt: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const chipRow: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: t.space[2],
  };

  return (
    <View style={wrap}>
      <Text style={prompt}>{header}</Text>
      <View style={chipRow}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={selected === opt.value}
            onPress={() => handleSelect(opt.value)}
          />
        ))}
      </View>
    </View>
  );
}
