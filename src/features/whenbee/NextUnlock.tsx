import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useNextUnlock } from './useNextUnlock';

// ──────────────────────────────────────────────────────────────────────────────
// NextUnlock — "what your next logs buy you", a one-line row: a key glyph,
// then `<n logs away> and <capability>`. At the cap it renders the sealed
// line instead. Shared by Today, the Progress tab, and the reward screen
// (plain-calibration-copy plan, Task 3) via `useNextUnlock`.
//
// No animation (hard rule) — this row is always rendered at full opacity.
// ──────────────────────────────────────────────────────────────────────────────

export function NextUnlock() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const unlock = useNextUnlock();

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };
  const line: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    flexShrink: 1,
  };
  const awayPhrase: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  return (
    <View style={row}>
      <Ionicons name="key-outline" size={t.iconSize.sm} color={t.colors.amberText} />
      {unlock.sealed ? (
        <Text style={line}>{tr('ring.sealed')}</Text>
      ) : (
        <Text style={line}>
          <Text style={awayPhrase}>{tr('ladder.away', { count: unlock.logsToNext })}</Text>
          {' '}
          {tr('ladder.rowSuffix', { capability: unlock.nextCapabilityLabel ?? '' })}
        </Text>
      )}
    </View>
  );
}
