import { useState } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import Animated, { useReducedMotion, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useDayCapacity, type DayCapacityResult } from '@/src/features/today/useDayCapacity';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { fmtHm } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// CapacityChip — the quiet "Honest Day" capacity read on Today.
//
// Pro + ready/off/denied: a collapsed single-line chip on surfaceSunken.
//   · collapsed: ⚡ "Honest day Xh Ym · fits | snug | ~Nh heavy" + chevron
//   · tap → expand in-place: a two-segment task/meetings bar + legend + free hrs
//   · over: amber tint + "~Nh heavy — move one?" (NO red, NO guilt, NO "overdue")
//   · denied/off: task-only load + calm "Turn on calendar in Settings" affordance
//   · "Pad my calendar" quiet link → /(modals)/honest-day (the WRITE surface)
//
// Free: frosted teaser "See if {day} will fit" + "Pro" pill → paywall.
//   NEVER renders the number, bar, or legend for free users (position gated too).
//
// Constraints: tokens only; reactCompiler Pressable gotcha (visual on inner View);
// reduced-motion → instant; no bounce/translate-in; amber-only verdict.
// ──────────────────────────────────────────────────────────────────────────────

export interface CapacityChipProps {
  /** Label for "today" vs a named day — e.g. "Today" or "Thursday". Defaults "Today". */
  weekdayLabel?: string;
  /**
   * Pre-resolved capacity result from the parent screen. When provided the chip
   * skips its own internal `useDayCapacity()` call, avoiding a double calendar
   * fetch when the screen and the chip both need the same data.
   */
  cap?: DayCapacityResult;
}

/** Percentage of the waking window committed (capped 0–1 for the bar). */
function committedFrac(committedMin: number, wakingWindowMin: number): number {
  if (wakingWindowMin <= 0) return 0;
  return Math.min(1, committedMin / wakingWindowMin);
}

function taskFrac(taskMin: number, wakingWindowMin: number): number {
  if (wakingWindowMin <= 0) return 0;
  return Math.min(1, taskMin / wakingWindowMin);
}

export function CapacityChip({ weekdayLabel = 'Today', cap: capProp }: CapacityChipProps): React.ReactElement | null {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Use a pre-resolved result from the parent when available (avoids double
  // calendar fetch). Fall back to the internal hook when the chip is used
  // standalone (e.g. in isolation tests without a parent-level cap call).
  const capInternal = useDayCapacity();
  const { status, load, events } = capProp ?? capInternal;
  const isPro2 = useEntitlement((s) => s.isPro);

  const [expanded, setExpanded] = useState(false);
  // Track dismissed state for the session (no nag)
  const [dismissed, setDismissed] = useState(false);

  // Animated expand height — opacity fade only (no translate/spring/bounce)
  const expandOpacity = useSharedValue(0);
  const expandStyle = useAnimatedStyle(() => ({
    opacity: expandOpacity.get(),
  }));

  if (dismissed) return null;

  // ── FREE PATH — teaser only (gate the number + bar position) ───────────────
  if (!isPro2) {
    const teaserWrap: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surfaceSunken,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[2.5],
      gap: t.space[2],
    };
    const teaserText: TextStyle = {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.inkSoft,
      flex: 1,
    };
    const pill: ViewStyle = {
      backgroundColor: t.colors.accentChip,
      borderRadius: t.radii.full,
      paddingHorizontal: t.capacity.pillPadX,
      paddingVertical: t.space[0.5],
    };
    const pillText: TextStyle = {
      ...(type.captionBold as unknown as TextStyle),
      color: t.colors.amberText,
    };

    return (
      <Pressable
        testID="capacity-teaser"
        accessibilityRole="button"
        accessibilityLabel={`See if ${weekdayLabel} will fit — Pro feature`}
        onPress={() =>
          router.push({ pathname: '/(modals)/paywall', params: { trigger: 'day_capacity' } })
        }
      >
        <View style={teaserWrap}>
          <Ionicons name="flash" size={t.iconSize.sm} color={t.colors.amberText} />
          <Text style={teaserText}>
            See if {weekdayLabel} will fit
          </Text>
          <View style={pill}>
            <Text style={pillText}>Pro</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // ── PRO PATH ────────────────────────────────────────────────────────────────

  if (!load) return null;

  const { verdict, taskMin, eventMin, freeMin, overByMin } = load;

  // Verdict suffix copy — amber-only, no red, no guilt
  function verdictSuffix(): string {
    if (verdict === 'comfortable') return '· fits';
    if (verdict === 'snug') return '· snug';
    const overH = Math.max(1, Math.round(overByMin / 60));
    return `· ~${overH}h heavy`;
  }

  // Amber tint only on 'over'
  const isOver = verdict === 'over';
  const overColor = t.colors.accentChip;

  // ── Collapsed chip styles ───────────────────────────────────────────────────
  const chipWrap: ViewStyle = {
    backgroundColor: isOver && expanded ? overColor : t.colors.surfaceSunken,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };

  const collapsedRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2.5],
  };

  const iconDisc: ViewStyle = {
    width: t.capacity.iconDisc,
    height: t.capacity.iconDisc,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accentChip,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const chipLabel: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };

  const verdictSuffixStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: isOver ? t.colors.amberText : t.colors.inkSoft,
  };

  // ── Expand logic ────────────────────────────────────────────────────────────
  function handleToggle(): void {
    const next = !expanded;
    setExpanded(next);
    expandOpacity.set(
      reduced ? (next ? 1 : 0) : withTiming(next ? 1 : 0, { duration: t.motion.fast }),
    );
  }

  // ── Expanded content styles ─────────────────────────────────────────────────
  const expandedWrap: ViewStyle = {
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[3],
    gap: t.space[2],
  };

  // Two-segment bar
  const barTrack: ViewStyle = {
    height: t.capacity.barH,
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.capacity.segRadius,
    overflow: 'hidden',
    flexDirection: 'row',
  };

  const totalFrac = committedFrac(taskMin + eventMin, Math.max(taskMin + eventMin + freeMin, 1));
  const tFrac = taskFrac(taskMin, Math.max(taskMin + eventMin + freeMin, 1));
  const eFrac = totalFrac - tFrac;

  const taskSeg: ViewStyle = {
    flex: tFrac,
    backgroundColor: t.colors.primary,
    borderTopLeftRadius: t.capacity.segRadius,
    borderBottomLeftRadius: t.capacity.segRadius,
  };
  const eventSeg: ViewStyle = {
    flex: Math.max(eFrac, 0),
    backgroundColor: t.colors.accent,
  };

  // Legend row
  const legendRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[4],
  };
  const legendItem: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
  };
  const legendDot = (color: string): ViewStyle => ({
    width: t.iconSize.xs,
    height: t.iconSize.xs,
    borderRadius: t.radii.full,
    backgroundColor: color,
  });
  const legendText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // Free hours label
  const freeLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  // Over copy — amber-only, calm offer
  const overCopy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
  };

  // "Pad my calendar" link — leads to the write/buffer surface
  const honestLink: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.primary,
    textDecorationLine: 'underline',
  };

  // Calendar settings nudge (denied / off with events)
  const nudgeText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const hasEvents = events.length > 0;
  const showNudge = (status === 'denied' || status === 'off') && !hasEvents;

  return (
    <View style={chipWrap}>
      {/* ── Collapsed row (always visible for Pro) ── */}
      <Pressable
        testID="capacity-chip-collapsed"
        accessibilityRole="button"
        accessibilityLabel={`Honest day ${fmtHm(taskMin + eventMin)} ${verdictSuffix()}. Tap to ${expanded ? 'collapse' : 'expand'}.`}
        accessibilityState={{ expanded }}
        onPress={handleToggle}
      >
        <View style={collapsedRow}>
          {/* ⚡ icon disc */}
          <View style={iconDisc}>
            <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.amberText} />
          </View>

          {/* "Honest day Xh Ym" */}
          <Text style={chipLabel} numberOfLines={1}>
            Honest day {fmtHm(taskMin + eventMin)}{' '}
            <Text style={verdictSuffixStyle}>{verdictSuffix()}</Text>
          </Text>

          {/* Chevron — flips when expanded */}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={t.iconSize.xs}
            color={t.colors.inkFaint}
          />
        </View>
      </Pressable>

      {/* ── Expanded content (opacity-only fade; no slide-in) ── */}
      {expanded && (
        <Animated.View
          testID="capacity-bar"
          style={[expandedWrap, expandStyle]}
        >
          {/* Two-segment bar */}
          <View style={barTrack}>
            {tFrac > 0 && <View style={taskSeg} />}
            {eFrac > 0 && <View style={eventSeg} />}
          </View>

          {/* Legend */}
          <View style={legendRow}>
            <View style={legendItem}>
              <View style={legendDot(t.colors.primary)} />
              <Text style={legendText}>tasks {fmtHm(taskMin)}</Text>
            </View>
            {eventMin > 0 && (
              <View style={legendItem}>
                <View style={legendDot(t.colors.accent)} />
                <Text style={legendText}>meetings {fmtHm(eventMin)}</Text>
              </View>
            )}
          </View>

          {/* Free hours */}
          <Text style={freeLabel}>
            {Math.floor(freeMin / 60)}h free
          </Text>

          {/* Over: calm amber nudge — no red, no guilt */}
          {isOver && (
            <Text style={overCopy}>
              ~{Math.max(1, Math.round(overByMin / 60))}h heavy — move one?
            </Text>
          )}

          {/* Calendar nudge for denied/off Pro users */}
          {showNudge && (
            <Text style={nudgeText}>
              Turn on calendar in Settings to count meetings
            </Text>
          )}

          {/* "Pad my calendar" quiet link → the write surface */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Pad my calendar — add honest buffers to today's events"
            onPress={() => router.push({ pathname: '/(modals)/honest-day' })}
          >
            <View>
              <Text style={honestLink}>Pad my calendar</Text>
            </View>
          </Pressable>

          {/* × dismiss for the session */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss capacity chip"
            onPress={() => setDismissed(true)}
            hitSlop={t.size.hitSlop}
          >
            <View>
              <Ionicons name="close" size={t.iconSize.xs} color={t.colors.inkFaint} />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
