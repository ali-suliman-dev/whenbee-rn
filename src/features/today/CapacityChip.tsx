import { useState } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import Animated, { useReducedMotion, withTiming, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { DayCapacityResult } from '@/src/features/today/useDayCapacity';
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
// Free: the honest task-only verdict as a calm one-liner ("Honest day Xh Ym ·
//   fits | snug | ~Nh heavy — move one?"). No meetings, no bar, no "Pad calendar"
//   — those are the Pro upgrade. Amber-never-red on 'over'. Nothing on an empty day.
//
// Constraints: tokens only; reactCompiler Pressable gotcha (visual on inner View);
// reduced-motion → instant; no bounce/translate-in; amber-only verdict.
// ──────────────────────────────────────────────────────────────────────────────

export interface CapacityChipProps {
  /**
   * Resolved capacity result from the parent screen. Required — the chip is a
   * pure presentational component; the caller (index.tsx) owns the single
   * `useDayCapacity()` call and passes the result in.
   */
  cap: DayCapacityResult;
}


export function CapacityChip({ cap }: CapacityChipProps): React.ReactElement | null {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Pure presentational — caller owns the useDayCapacity() call.
  const { status, load, events, isPro: isProCap } = cap;
  const isPro2 = useEntitlement((s) => s.isPro) || isProCap;

  const [expanded, setExpanded] = useState(false);
  // Track dismissed state for the session (no nag)
  const [dismissed, setDismissed] = useState(false);

  // Animated expand height — opacity fade only (no translate/spring/bounce)
  const expandOpacity = useSharedValue(0);
  const expandStyle = useAnimatedStyle(() => ({
    opacity: expandOpacity.get(),
  }));

  if (dismissed) return null;

  // ── FREE PATH — the honest task-only capacity verdict (no calendar) ─────────
  // Free users get the real "will my day fit?" read from their planned tasks:
  // task minutes vs the waking window, as a calm one-liner. No meetings, no bar,
  // no "Pad calendar" (those are the Pro upgrade, rendered below). Amber-never-red
  // on 'over'. An empty day (no queued tasks) says nothing at all.
  if (!isPro2) {
    if (!load || load.taskMin === 0) return null;

    const isOverFree = load.verdict === 'over';
    const freeSuffixCopy =
      load.verdict === 'comfortable'
        ? '· fits'
        : load.verdict === 'snug'
          ? '· snug'
          : `· ~${Math.max(1, Math.round(load.overByMin / 60))}h heavy — move one?`;

    const freeWrap: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderRadius: t.radii.card,
      borderCurve: 'continuous',
      paddingLeft: t.space[4],
      paddingRight: t.space[2],
      paddingVertical: t.space[2.5],
      gap: t.space[2],
    };
    const freeDisc: ViewStyle = {
      width: t.capacity.iconDisc,
      height: t.capacity.iconDisc,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.accentChip,
      alignItems: 'center',
      justifyContent: 'center',
    };
    const freeLabel: TextStyle = {
      ...(type.bodySm as unknown as TextStyle),
      color: t.colors.ink,
      flex: 1,
    };
    const freeSuffixStyle: TextStyle = {
      ...(type.bodySm as unknown as TextStyle),
      color: isOverFree ? t.colors.amberText : t.colors.inkSoft,
    };

    return (
      <View style={freeWrap} testID="capacity-free">
        <View style={freeDisc}>
          <Ionicons name="flash" size={t.iconSize.xs} color={t.colors.amberText} />
        </View>
        <Text style={freeLabel} numberOfLines={1}>
          Honest day {fmtHm(load.taskMin)}{' '}
          <Text style={freeSuffixStyle}>{freeSuffixCopy}</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss capacity"
          onPress={() => setDismissed(true)}
          hitSlop={t.size.hitSlop}
          style={{ paddingRight: t.space[2], paddingVertical: t.space[1] }}
        >
          <Ionicons name="close" size={t.iconSize.xs} color={t.colors.inkFaint} />
        </Pressable>
      </View>
    );
  }

  // ── PRO PATH ────────────────────────────────────────────────────────────────

  if (!load) return null;

  const { verdict, taskMin, eventMin, freeMin, openMin, overByMin } = load;

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
    // Matches the task-list rows (t.colors.surface) so the chip reads as part of
    // the same card system, not a separate sunken well. Amber tint still wins
    // when the day is over capacity and expanded.
    backgroundColor: isOver && expanded ? overColor : t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };

  const collapsedRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingLeft: t.space[4],
    paddingRight: t.space[4],
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

  // Normalize bar segments to the waking window (= freeMin + eventMin), not
  // taskMin+eventMin+freeMin which under-fills as tasks grow (M3 fix).
  const window = Math.max(freeMin + eventMin, 1);
  const tFrac = Math.min(1, taskMin / window);
  const eFrac = Math.min(1 - tFrac, eventMin / window);

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

  // Over copy — amber-only, calm offer
  const overCopy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
  };

  // ── Footer toolbar: "Xh open" left, "Pad calendar" pill right ──────────────
  const footerDivider: ViewStyle = {
    height: t.borderWidth.hairline || 1,
    backgroundColor: t.colors.hairline,
  };

  const toolbarRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  // "open" = the real leftover (window − committed) = the empty bar segment. Shown
  // as a quiet value+label so it reconciles with what the user sees in the bar.
  const openLabel: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const openValue: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    fontVariant: ['tabular-nums'],
  };

  // "Pad calendar" — the one Pro action. Plain text (no pill fill, no icon) so
  // it reads as a footer link, not another button competing with the screen's
  // primary CTA → the honest-day write surface. Sits right of "Hide this",
  // distinguished from it by color alone (indigo vs faint gray).
  const padLinkText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.primary,
  };

  // "Hide this" — the session dismiss, moved out of the header entirely. It used
  // to sit beside the chevron as a ×, which put two different-outcome controls
  // (expand vs. permanently dismiss) at the same spot the thumb lands right
  // after expanding — an easy mis-tap. Living here means it's only reachable
  // after the user has actually seen the expanded content.
  const rightActions: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[4],
  };
  const hideLinkText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
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
      {/* ── Header: toggle only — no dismiss up here (moved to the footer) ── */}
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

          {/* Footer toolbar: real leftover ("open" = window − committed) + the one
              Pro action. "open" equals the empty bar segment, so number and bar agree. */}
          <View style={footerDivider} />
          <View style={toolbarRow}>
            <Text style={openLabel}>
              <Text style={openValue}>{fmtHm(openMin)}</Text> open
            </Text>

            <View style={rightActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hide the Honest Day chip for this session"
                onPress={() => setDismissed(true)}
                hitSlop={t.size.hitSlop}
              >
                <Text style={hideLinkText}>Hide this</Text>
              </Pressable>

              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Pad my calendar — add honest buffers to today's events"
                onPress={() => router.push({ pathname: '/(modals)/honest-day' })}
                hitSlop={t.size.hitSlop}
              >
                <Text style={padLinkText}>Pad calendar</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
