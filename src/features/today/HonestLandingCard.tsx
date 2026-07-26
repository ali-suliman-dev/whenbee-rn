// ──────────────────────────────────────────────────────────────────────────────
// HonestLandingCard — the Today day-read, free and Pro alike. Replaces the
// capacity verdict, which divided by a fixed 14h window and therefore always
// said "fits".
//
// Pro is the same component with more data: `eventMinAhead` adds a booked-time
// slice to the bar, a legend explaining it, and swaps the footer offer for how
// much is already booked. A Pro user who denies calendar access passes 0 and
// gets the free card — the degraded state is a complete one, not a broken one.
// A free user with no booked time gets a quiet text offer to connect their
// calendar in the footer area instead — never a fabricated bar segment; the
// free bar shows only what queued tasks justify.
//
// Anatomy (deliberately the old chip's, so it sits in the card rhythm rather
// than becoming the loudest thing on the screen):
//   ⚡ disc · one-line headline
//   bar: now → landing, indigo up to end-of-day, amber past it
//   scale: now · dayEnd · landing
//   legend: tasks/booked/over colour key (only once booked time exists)
//   hairline
//   footer: fact left, one quiet action right
//   free upsell: lock glyph · offer text · "Add it" (only free + calendar off)
//
// 'past' renders NO bar on purpose: past end-of-day the bar could only be 100%
// amber, which turns the calmest state into the loudest — a guilt signal by
// accident, and the no-guilt invariant outranks visual consistency.
//
// Every string comes from `honestLandingCopy`; nothing user-facing is written
// here. Nothing animates on entrance — the card appears instantly on mount,
// collapsed or expanded, in whichever state kv remembers. The bar/scale/
// divider/footer block only fades in when the user actually taps the header
// to reveal it (see `hasToggled` below); it never fades on an ordinary mount.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatClockMeridiem } from '@/src/lib/time';
import { haptics } from '@/src/lib/haptics';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import {
  landingHeadline,
  landingFooter,
  landingScale,
  landingLegend,
  landingUpsell,
} from './honestLandingCopy';
import type { HonestLandingResult } from './useHonestLanding';
import { useLandingVariant } from './useLandingVariant';
import { readLandingCollapsed, writeLandingCollapsed } from './landingCollapse';

export type LandingAction =
  | 'move-tail'
  | 'add-task'
  | 'start-one'
  | 'move-to-tomorrow'
  | 'pad-calendar'
  | 'connect-calendar';

export interface HonestLandingCardProps {
  result: HonestLandingResult;
  doneCount: number;
  doneHonestMin: number;
  /**
   * Pro only: calendar minutes still ahead of now. 0 (the default) is the free
   * card — and also the Pro card of anyone who denied calendar access, which is
   * the point: the degraded state is the free state, not a broken one.
   */
  eventMinAhead?: number;
  /** Fires the footer action. The kind tells the caller which route to take. */
  onAction: (kind: LandingAction) => void;
}

/** Which offer the footer is making — mirrors `landingFooter`'s own branch order. */
function actionKindFor(result: HonestLandingResult, bookedMin: number): LandingAction {
  if (result.logsToWarm > 0) return 'start-one';
  if (result.landing.kind === 'past') return 'move-to-tomorrow';
  if (result.landing.kind === 'over' && result.landing.tail) return 'move-tail';
  if (bookedMin > 0) return 'pad-calendar';
  return 'add-task';
}

/** End of day the way a person says it: "9:00pm" → "9", "17:00" → "17". */
function spokenDayEnd(dayEndMs: number): string {
  return formatClockMeridiem(dayEndMs).replace(/:00(am|pm)?$/, '');
}

/** Splits the footer text around its emphasised span, without a cast. */
function splitAroundBold(text: string, boldSpan: string | null): [string, string] {
  if (!boldSpan) return [text, ''];
  const at = text.indexOf(boldSpan);
  if (at < 0) return [text, ''];
  return [text.slice(0, at), text.slice(at + boldSpan.length)];
}

export function HonestLandingCard({
  result,
  doneCount,
  doneHonestMin,
  eventMinAhead = 0,
  onAction,
}: HonestLandingCardProps): React.ReactElement | null {
  const t = useTheme();
  const { variant } = useLandingVariant();
  const isPro = useEntitlement((s) => s.isPro);
  const { landing, range, logsToWarm, dayEndMs, nowMs } = result;

  // Collapse state — seeded synchronously from kv so the card renders in its
  // remembered state on the first frame; a card that expands a beat after
  // mount reads as a glitch. 'past' has no bar to hide, so it never collapses.
  const [collapsed, setCollapsed] = useState(() => readLandingCollapsed());
  const canToggle = landing.kind !== 'past';
  const expanded = !canToggle || !collapsed;

  // Mirrors DayTimeline's `entrancesDone` guard, inverted: that flag starts
  // false and flips true to STOP a replaying entrance; this one starts false
  // and flips true to START one. Nothing animates on an ordinary mount — the
  // body block below only gets `entering` once the user has actually pressed
  // the header, so a ready-expanded card (the default) never fades in.
  const [hasToggled, setHasToggled] = useState(false);

  const reducedMotion = useReducedMotion();
  const chevronRotation = useSharedValue(expanded ? 180 : 0);
  useEffect(() => {
    const target = expanded ? 180 : 0;
    chevronRotation.set(
      reducedMotion
        ? target
        : withTiming(target, { duration: t.motion.base, easing: Easing.out(Easing.cubic) }),
    );
  }, [expanded, reducedMotion, chevronRotation, t.motion.base]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.get()}deg` }],
  }));

  if (landing.kind === 'empty') return null;

  const isOver = landing.kind === 'over';
  const showBar = landing.kind !== 'past' && expanded;

  function toggleCollapse() {
    haptics.light();
    setHasToggled(true);
    setCollapsed((v) => {
      const next = !v;
      writeLandingCollapsed(next);
      return next;
    });
  }

  const headline = landingHeadline(landing, {
    rangeLowMs: range?.lowMs,
    rangeHighMs: range?.highMs,
    variant,
  });
  // A range in the headline suppresses the landing label on the scale — the card
  // must not disclaim a precise minute and then name one.
  const scale = landingScale(landing, { nowMs, dayEndMs, hasRange: range !== null });

  // Bar geometry — every span is measured minutes, nothing is invented.
  // 'over': now → landing, with the end-of-day boundary as the colour change.
  // 'clear': now → end-of-day, filled only as far as the landing.
  const landingMs = landing.landingMs ?? dayEndMs;
  const spanEndMs = isOver ? landingMs : dayEndMs;
  const totalMs = Math.max(1, spanEndMs - nowMs);
  const inDayMs = Math.max(0, Math.min(dayEndMs, landingMs) - nowMs);
  const overMs = isOver ? Math.max(0, landingMs - dayEndMs) : 0;
  const restMs = Math.max(0, totalMs - inDayMs - overMs);

  // Booked calendar time is committed time INSIDE the same span — it takes its
  // slice out of the in-day segment rather than extending the bar. The bar
  // always spans now → landing; booked time can only change what the span is
  // made of.
  const meetMs = Math.max(0, Math.min(eventMinAhead * 60_000, inDayMs));
  const taskInDayMs = Math.max(0, inDayMs - meetMs);

  // The legend and the "already booked" footer offer read off these SAME
  // measured spans (never a second computation from `eventMinAhead` directly)
  // so the words under the bar can never disagree with the bar itself.
  const taskMin = Math.round(taskInDayMs / 60_000);
  const bookedMin = Math.round(meetMs / 60_000);
  const overMin = Math.round(overMs / 60_000);
  const legend = landingLegend({ taskMin, bookedMin, overMin });

  const footer = landingFooter(landing, {
    doneCount,
    doneHonestMin,
    logsToWarm,
    dayEndShort: spokenDayEnd(dayEndMs),
    bookedMin,
  });

  // The free calendar offer: a free user (or a Pro user who denied access —
  // they land back on `eventMinAhead: 0` too, but `isPro` keeps them from ever
  // seeing a pitch for something they already own) with no calendar time in the
  // picture and at least one task queued. Never on a past day — nothing to add.
  const showUpsell = !isPro && eventMinAhead === 0 && landing.kind !== 'past';
  const upsell = showUpsell ? landingUpsell() : null;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingTop: t.space[3.5],
    paddingBottom: t.space[3],
  };
  const topRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const disc: ViewStyle = {
    width: t.capacity.iconDisc,
    height: t.capacity.iconDisc,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentChip,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const headText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };
  const clockText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: isOver ? t.colors.amberText : t.colors.ink,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    fontVariant: ['tabular-nums'],
  };
  const track: ViewStyle = {
    height: t.capacity.barH,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.capacity.segRadius,
    overflow: 'hidden',
    flexDirection: 'row',
    marginTop: t.space[3],
  };
  const scaleRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: t.space[1.5],
  };
  const scaleText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const legendRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    marginTop: t.space[1.5],
  };
  const legendItem: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const legendDot: ViewStyle = {
    width: t.capacity.legendDot,
    height: t.capacity.legendDot,
    borderRadius: t.radii.full,
  };
  const legendText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint };
  const upsellRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    marginTop: t.space[2],
  };
  const upsellText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };
  const upsellAction: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.primary,
    flexShrink: 0,
  };
  const divider: ViewStyle = {
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.hairline,
    marginTop: t.space[3],
  };
  const footRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space[2],
    marginTop: t.space[2.5],
  };
  const footText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };
  const footBold: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: isOver ? t.colors.amberText : t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const actionText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.primary,
  };

  const [beforeBold, afterBold] = splitAroundBold(footer.text, footer.boldSpan);

  // Same tokens the bar segments render with — the legend dots must never be
  // able to drift from the colours they're explaining.
  const legendColor: Record<'tasks' | 'booked' | 'over', string> = {
    tasks: t.colors.primary,
    booked: t.colors.primaryEdge,
    over: t.colors.accent,
  };

  const headerRow = (
    <View style={topRow}>
      <View style={disc}>
        <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.amberText} />
      </View>
      <Text style={headText} numberOfLines={2}>
        {headline.lead}
        <Text style={clockText}>{headline.clock}</Text>
        {headline.trail}
      </Text>
      {canToggle ? (
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View style={card} testID="honest-landing">
      {canToggle ? (
        <Pressable
          onPress={toggleCollapse}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={t.size.hitSlop}
        >
          {headerRow}
        </Pressable>
      ) : (
        headerRow
      )}

      {expanded ? (
        <Animated.View
          testID="landing-body"
          entering={hasToggled ? FadeIn.duration(t.motion.base) : undefined}
        >
          {showBar ? (
            <>
              <View style={track} testID="landing-bar">
                {taskInDayMs > 0 ? (
                  <View
                    testID="landing-seg-in"
                    style={{ flex: taskInDayMs, backgroundColor: t.colors.primary }}
                  />
                ) : null}
                {meetMs > 0 ? (
                  <View
                    testID="landing-seg-meet"
                    style={{ flex: meetMs, backgroundColor: t.colors.primaryEdge }}
                  />
                ) : null}
                {overMs > 0 ? (
                  <View
                    testID="landing-seg-over"
                    style={{ flex: overMs, backgroundColor: t.colors.accent }}
                  />
                ) : null}
                {restMs > 0 ? <View style={{ flex: restMs }} /> : null}
              </View>
              <View style={scaleRow}>
                {scale.map((label) => (
                  <Text key={label} style={scaleText}>
                    {label}
                  </Text>
                ))}
              </View>
              {legend.length > 0 ? (
                <View style={legendRow} testID="landing-legend">
                  {legend.map((entry) => (
                    <View key={entry.key} style={legendItem}>
                      <View style={[legendDot, { backgroundColor: legendColor[entry.key] }]} />
                      <Text style={legendText}>{entry.value}</Text>
                      <Text style={legendText}>{entry.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <View style={divider} />
          <View style={footRow}>
            <Text style={footText} numberOfLines={1}>
              {beforeBold}
              {footer.boldSpan ? <Text style={footBold}>{footer.boldSpan}</Text> : null}
              {afterBold}
            </Text>
            {footer.action ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={footer.action}
                onPress={() => onAction(actionKindFor(result, bookedMin))}
                hitSlop={t.size.hitSlop}
              >
                <Text style={actionText}>{footer.action}</Text>
              </Pressable>
            ) : null}
          </View>

          {upsell ? (
            <View style={upsellRow} testID="landing-upsell">
              <Ionicons name="lock-closed" size={t.iconSize.xs} color={t.colors.accent} />
              <Text style={upsellText} numberOfLines={1}>
                {upsell.text}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={upsell.action}
                onPress={() => onAction('connect-calendar')}
                hitSlop={t.size.hitSlop}
              >
                <Text style={upsellAction}>{upsell.action}</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
