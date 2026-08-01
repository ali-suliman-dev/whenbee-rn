import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useNextUnlock } from './useNextUnlock';

// ──────────────────────────────────────────────────────────────────────────────
// NextUnlock — "what your next logs buy you", a one-line row: a key glyph,
// then the full "<n> more logs and <capability>" sentence. At the cap it
// renders the sealed line instead. Shared by Today, the Progress tab, and the
// reward screen (plain-calibration-copy plan, Task 3) via `useNextUnlock`.
//
// The sentence is a SINGLE translation key (`ladder.row_one`/`row_other`),
// never two independently-translated fragments glued together in JSX — word
// order and capability-noun agreement stay entirely in the translator's
// hands. The whole line is styled as one emphasised unit rather than
// re-splitting the string to bold just the count.
//
// No animation (hard rule) — this row is always rendered at full opacity.
// ──────────────────────────────────────────────────────────────────────────────

export function NextUnlock() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { nextCapabilityLabel, logsToNext } = useNextUnlock();

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

  // Narrow on `nextCapabilityLabel` itself (not a separate `sealed` flag) so
  // TypeScript proves it's a string in the sentence branch below — no `??`
  // fallback, no `!` assertion.
  if (nextCapabilityLabel === null) {
    return (
      <View style={row}>
        <Ionicons name="key-outline" size={t.iconSize.sm} color={t.colors.amberText} />
        <Text style={line}>{tr('ring.sealed')}</Text>
      </View>
    );
  }

  return (
    <View style={row}>
      <Ionicons name="key-outline" size={t.iconSize.sm} color={t.colors.amberText} />
      <Text style={line}>
        {tr('ladder.row', { count: logsToNext, capability: nextCapabilityLabel })}
      </Text>
    </View>
  );
}
