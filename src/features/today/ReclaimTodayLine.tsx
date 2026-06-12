import { Text, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ReclaimTodayLine — a quiet, one-line tally of the minutes Today handed back.
//
// Sits directly under the honeycomb strip as a calm caption (mirrors FocusCard's
// provenance line). Amber carries the reclaim identity; nothing here ever scolds.
// HIDDEN entirely when the sum is 0 — no "+0m", no empty placeholder.
// ──────────────────────────────────────────────────────────────────────────────

export function ReclaimTodayLine({ minutes }: { minutes: number }) {
  const t = useTheme();

  // Nothing banked today → render nothing. The line earns its place only with a
  // real number behind it.
  if (minutes <= 0) return null;

  const line: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  return <Text style={line}>+{minutes}m reclaimed today</Text>;
}
