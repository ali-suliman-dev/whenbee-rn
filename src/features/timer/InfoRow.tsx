import type { ReactNode } from 'react';
import { View, StyleSheet, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// InfoRow — the Live-Timer's full-width label→value ledger row.
//
//   GUESS → HONEST                                 5m → ~5m
//   STARTED                                          13:50
//   FINISH ~                                         13:55
//
// A muted uppercase label sits left; a tabular value sits right. Rows stack under
// the timer ring and are divided by a hairline (the first row omits its top rule).
// The value is composed of one or more `LedgerValue` spans so a single row can mix
// ink / faint / amber parts (honest values are always amber — the honey semantic).
// ──────────────────────────────────────────────────────────────────────────────

export function InfoRow({
  label,
  first = false,
  children,
}: {
  label: string;
  /** The first row in the ledger drops its top divider. */
  first?: boolean;
  children: ReactNode;
}) {
  const t = useTheme();

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: t.space[3],
    borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
    borderTopColor: t.colors.hairline,
  };
  const labelStyle: TextStyle = {
    ...(type.labelXs as TextStyle),
    color: t.colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: t.letterSpacing.normal,
  };
  const value: ViewStyle = { flexDirection: 'row', alignItems: 'baseline' };

  return (
    <View style={row}>
      <AppText style={labelStyle}>{label}</AppText>
      <View style={value}>{children}</View>
    </View>
  );
}

// One tabular span of a row's value. `amber` = the honest number (honey semantic);
// `faint` = the connective glyph (e.g. the "→" between guess and honest).
export function LedgerValue({
  children,
  amber = false,
  faint = false,
  ...rest
}: TextProps & { amber?: boolean; faint?: boolean }) {
  const t = useTheme();
  const style: TextStyle = {
    // `as unknown as` — the role's `fontVariant` is a readonly tuple (`as const`),
    // which TextStyle's mutable `FontVariant[]` rejects on a direct cast. Same
    // pattern the other tabular numeral roles use (see TimerRing).
    ...(type.numLedger as unknown as TextStyle),
    color: amber ? t.colors.accent : faint ? t.colors.inkFaint : t.colors.ink,
  };
  return (
    <AppText style={style} {...rest}>
      {children}
    </AppText>
  );
}
