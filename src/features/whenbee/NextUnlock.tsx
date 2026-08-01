import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useUnlockSentence } from './useUnlockSentence';
import type { CompanionCapability } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// NextUnlock — "what your logs buy you", a one-line row: a key glyph, then the
// full sentence. Shared by Today, the Progress tab, and the reward screen
// (plain-calibration-copy plan, Task 3).
//
// The sentence itself is resolved by `useUnlockSentence` — one owner, so this
// row and CalibrationCard's spoken label can never disagree about whether the
// next capability is Pro.
//
// The row owns its own accessibility label so it is never swallowed into a
// neighbouring grouped card describing a DIFFERENT subject (see reward.tsx,
// where the card above it talks about the just-logged category while this row
// talks about the whole companion).
//
// No animation (hard rule) — this row is always rendered at full opacity.
// ──────────────────────────────────────────────────────────────────────────────

interface NextUnlockProps {
  /** Set on the log that just crossed a tier: render "you unlocked X" instead of
   *  handing the user a fresh target on their payoff screen. */
  justUnlockedId?: CompanionCapability['id'] | null;
}

export function NextUnlock({ justUnlockedId = null }: NextUnlockProps) {
  const t = useTheme();
  const sentence = useUnlockSentence(justUnlockedId);

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };
  const line: TextStyle = {
    ...(type.bodySmSemibold as unknown as TextStyle),
    color: t.colors.ink,
    flexShrink: 1,
  };

  return (
    <View style={row} accessible accessibilityLabel={sentence}>
      <Ionicons name="key-outline" size={t.iconSize.sm} color={t.colors.amberText} />
      <Text style={line}>{sentence}</Text>
    </View>
  );
}
