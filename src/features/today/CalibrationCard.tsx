import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useNextUnlock } from '@/src/features/whenbee/useNextUnlock';
import { resolveUnlockSentence } from '@/src/features/whenbee/useUnlockSentence';
import { spokenText } from '@/src/features/whenbee/a11yText';
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
// F8: the tier/pct pair is the LEAD category's read (`aggregateCalibration`
// picks the most-ripened tracked category), not an aggregate across every
// area — an eyebrow names that scope so the number never reads as "your
// overall calibration" when it's really the sharpest one.
//
// F19: `useNextUnlock()` is resolved exactly ONCE here for the whole card
// subtree (it opens store subscriptions + recomputes `aggregateCalibration`
// on every call) and passed down to `<NextUnlock unlock={unlock}/>` instead
// of letting the child re-derive it — see that component's header comment.
//
// No animation (hard rule) — the card renders at full opacity from mount.
// ──────────────────────────────────────────────────────────────────────────────

export function CalibrationCard() {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const isPro = useEntitlement((s) => s.isPro);
  const unlock = useNextUnlock();
  const { tierLabel, pct } = unlock;
  // The SAME resolver <NextUnlock/> renders below, so the spoken label can never
  // drift from the visible row (it used to compose its own copy and lost the
  // Pro qualifier). Both subjects here are the aggregate, so one grouped label
  // covering the card and the row is honest.
  const unlockText = resolveUnlockSentence(unlock, isPro, null, tr);

  const card: ViewStyle = {
    backgroundColor: t.colors.honeyWash,
    borderRadius: t.radii.card,
    borderWidth: t.borderWidth.card,
    padding: t.space[4],
    gap: t.space[2.5],
  };
  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
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
    // F12: the tier word may run long in Swedish — it shrinks/ellipsises so
    // it can never push the percentage (the fixed-width element) off-card.
    flexShrink: 1,
  };
  const pctStyle: TextStyle = {
    fontSize: t.fontSize.lg,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    fontFamily: t.fontFamily.mono,
    fontVariant: ['tabular-nums'],
    color: t.colors.amberText,
    flexShrink: 0,
  };
  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  // F14: the header ring floors its fill at `ring.endowedPct` so a cold Raw
  // start never reads as an empty circle; this bar sits directly beneath that
  // ring showing the SAME number, so it follows the same floor — otherwise
  // the two visually disagree about what "0%" looks like on the same card.
  // The TEXT above still shows the true, unfloored `pct` (never fudged); only
  // the bar's fill width is floored, exactly like the ring's arc.
  const fill: ViewStyle = {
    height: '100%',
    width: `${Math.max(t.ring.endowedPct, pct)}%`,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View
      style={card}
      accessible
      accessibilityLabel={tr('card.a11y', {
        scope: tr('card.eyebrow'),
        tier: tierLabel,
        pct,
        // F10: strip the decorative ✦ from the spoken sealed line — it is a
        // visual-only cue, not a word VoiceOver/TalkBack should read out.
        unlock: spokenText(unlockText),
      })}
    >
      <Text style={eyebrowStyle}>{tr('card.eyebrow')}</Text>
      <View style={row}>
        <Text style={tierStyle} numberOfLines={1}>
          {tierLabel}
        </Text>
        <Text style={pctStyle}>{tr('card.pct', { pct })}</Text>
      </View>
      <View style={track}>
        <View style={fill} testID="calibration-card-fill" />
      </View>
      <NextUnlock unlock={unlock} />
    </View>
  );
}
