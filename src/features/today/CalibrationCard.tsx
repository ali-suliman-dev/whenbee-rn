import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { useNextUnlock } from '@/src/features/whenbee/useNextUnlock';
import { useUnlockSentence } from '@/src/features/whenbee/useUnlockSentence';
import { NextUnlock } from '@/src/features/whenbee/NextUnlock';

// ──────────────────────────────────────────────────────────────────────────────
// CalibrationCard — Today's plain calibration read, directly under the header
// ring: the tier word + percentage, a progress bar, then the next-unlock
// sentence (`<NextUnlock/>`). Mock reference: docs/product/mocks/
// mascot-honey-fix.html, screen 1 (plain-calibration-copy plan, Task 4).
//
// At the cap (`sealed`) this still renders the tier word and 100% + a full
// bar — `NextUnlock` swaps in the sealed line on its own, so there is nothing
// here that reads as a demand once calibration is done.
//
// No animation (hard rule) — the card renders at full opacity from mount.
// ──────────────────────────────────────────────────────────────────────────────

export function CalibrationCard() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { tierLabel, pct } = useNextUnlock();
  // The SAME resolver <NextUnlock/> renders below, so the spoken label can never
  // drift from the visible row (it used to compose its own copy and lost the
  // Pro qualifier). Both subjects here are the aggregate, so one grouped label
  // covering the card and the row is honest.
  const unlockText = useUnlockSentence();

  const card: ViewStyle = {
    backgroundColor: t.colors.honeyWash,
    borderRadius: t.radii.card,
    borderWidth: t.borderWidth.card,
    padding: t.space[4],
    gap: t.space[2.5],
  };
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[3],
  };
  const tierStyle: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    fontFamily: t.fontFamily.ui,
    color: t.colors.ink,
  };
  const pctStyle: TextStyle = {
    fontSize: t.fontSize.lg,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    fontFamily: t.fontFamily.mono,
    fontVariant: ['tabular-nums'],
    color: t.colors.amberText,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const fill: ViewStyle = {
    height: '100%',
    width: `${pct}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View
      style={card}
      accessible
      accessibilityLabel={tr('card.a11y', { tier: tierLabel, pct, unlock: unlockText })}
    >
      <View style={row}>
        <Text style={tierStyle}>{tierLabel}</Text>
        <Text style={pctStyle}>{pct}%</Text>
      </View>
      <View style={track}>
        <View style={fill} />
      </View>
      <NextUnlock />
    </View>
  );
}
