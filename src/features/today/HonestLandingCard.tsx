// ──────────────────────────────────────────────────────────────────────────────
// HonestLandingCard — the Today day-read, free and Pro alike. Replaces the
// capacity verdict, which divided by a fixed 14h window and therefore always
// said "fits".
//
// Pro is the same component with more data: `eventMinAhead` adds a meetings
// slice to the bar and swaps the footer offer for "Pad calendar". A Pro user who
// denies calendar access passes 0 and gets the free card — the degraded state is
// a complete one, not a broken one.
//
// Anatomy (deliberately the old chip's, so it sits in the card rhythm rather
// than becoming the loudest thing on the screen):
//   ⚡ disc · one-line headline
//   bar: now → landing, indigo up to end-of-day, amber past it
//   scale: now · dayEnd · landing
//   hairline
//   footer: fact left, one quiet action right
//
// 'past' renders NO bar on purpose: past end-of-day the bar could only be 100%
// amber, which turns the calmest state into the loudest — a guilt signal by
// accident, and the no-guilt invariant outranks visual consistency.
//
// Every string comes from `honestLandingCopy`; nothing user-facing is written
// here. Nothing animates on entrance.
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
import { landingHeadline, landingFooter, landingScale } from './honestLandingCopy';
import type { HonestLandingResult } from './useHonestLanding';
import { useLandingVariant } from './useLandingVariant';
import { readLandingCollapsed, writeLandingCollapsed } from './landingCollapse';

export type LandingAction =
  | 'move-tail'
  | 'add-task'
  | 'start-one'
  | 'move-to-tomorrow'
  | 'pad-calendar';

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
function actionKindFor(result: HonestLandingResult, hasMeetings: boolean): LandingAction {
  if (result.logsToWarm > 0) return 'start-one';
  if (result.landing.kind === 'past') return 'move-to-tomorrow';
  if (result.landing.kind === 'over' && result.landing.tail) return 'move-tail';
  if (hasMeetings) return 'pad-calendar';
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
  const { landing, range, logsToWarm, dayEndMs, nowMs } = result;

  // Collapse state — seeded synchronously from kv so the card renders in its
  // remembered state on the first frame; a card that expands a beat after
  // mount reads as a glitch. 'past' has no bar to hide, so it never collapses.
  const [collapsed, setCollapsed] = useState(() => readLandingCollapsed());
  const canToggle = landing.kind !== 'past';
  const expanded = !canToggle || !collapsed;

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
  const hasMeetings = eventMinAhead > 0;
  // A range in the headline suppresses the landing label on the scale — the card
  // must not disclaim a precise minute and then name one.
  const scale = landingScale(landing, { nowMs, dayEndMs, hasRange: range !== null });
  const footer = landingFooter(landing, {
    doneCount,
    doneHonestMin,
    logsToWarm,
    dayEndShort: spokenDayEnd(dayEndMs),
    hasMeetings,
  });

  // Bar geometry — every span is measured minutes, nothing is invented.
  // 'over': now → landing, with the end-of-day boundary as the colour change.
  // 'clear': now → end-of-day, filled only as far as the landing.
  const landingMs = landing.landingMs ?? dayEndMs;
  const spanEndMs = isOver ? landingMs : dayEndMs;
  const totalMs = Math.max(1, spanEndMs - nowMs);
  const inDayMs = Math.max(0, Math.min(dayEndMs, landingMs) - nowMs);
  const overMs = isOver ? Math.max(0, landingMs - dayEndMs) : 0;
  const restMs = Math.max(0, totalMs - inDayMs - overMs);

  // Meetings are committed time INSIDE the same span — they take their slice out
  // of the in-day segment rather than extending the bar. The bar always spans
  // now → landing; a meeting can only change what the span is made of.
  const meetMs = Math.max(0, Math.min(eventMinAhead * 60_000, inDayMs));
  const taskInDayMs = Math.max(0, inDayMs - meetMs);

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
        <Animated.View entering={FadeIn.duration(t.motion.base)}>
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
                onPress={() => onAction(actionKindFor(result, hasMeetings))}
                hitSlop={t.size.hitSlop}
              >
                <Text style={actionText}>{footer.action}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
