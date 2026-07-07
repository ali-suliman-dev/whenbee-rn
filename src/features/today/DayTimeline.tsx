/**
 * DayTimeline — renders the computed day plan as a vertical timeline.
 *
 * Reads useDayPlan internally (self-contained, no props needed for the plan).
 * Renders:
 *   - 'task' items: start clock + label + honest duration
 *   - 'event' items: greyed, read-only meeting block (non-interactive)
 *   - 'breather' items: a thin gap spacer
 *   - Learned focus-window band behind rows that fall inside it (personal only)
 *   - Header chip: "done by {time}" → opens a time picker → setDoneBy
 *   - Overflow banner (cut-one / multi-cut / push-deadline): calm amber, no guilt,
 *     "move to tomorrow?" action
 *
 * Motion: rows fade in via entering-only opacity (no bounce / translate-in).
 * Reduced-motion → final state. reactCompiler Pressable gotcha: visual styles on
 * inner View, Pressable is a bare touch wrapper.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDayPlan } from './useDayPlan';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { ActionSheet, type ActionSheetItem } from '@/src/components/ActionSheet';
import { formatClock, formatClockMeridiem, fmtHm } from '@/src/lib/time';
import type { PlanTimelineItem, PlanVerdict } from '@/src/domain/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert epoch ms to local minute-of-day (0–1439). */
function epochToLocalMin(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Returns true when the item's time range overlaps the focus window.
 * Both ranges are in minutes-of-day.
 */
function overlapsWindow(
  itemStartMin: number,
  itemEndMin: number,
  windowStartMin: number,
  windowEndMin: number,
): boolean {
  return itemStartMin < windowEndMin && itemEndMin > windowStartMin;
}

/**
 * Derives the label text for an overflow verdict — calm, no guilt.
 * Uses conversion-psychology: name the gap, offer a calm path forward.
 */
function overflowLabel(verdict: PlanVerdict): string {
  if (verdict.kind === 'cut-one') {
    return `This won't all fit today — move "${verdict.cut.label}" to tomorrow?`;
  }
  if (verdict.kind === 'multi-cut') {
    const count = verdict.cuts.length;
    return `${count} tasks won't fit today — move them to tomorrow?`;
  }
  if (verdict.kind === 'push-deadline') {
    const feasibleStr = formatClockMeridiem(verdict.feasibleDeadline);
    return `You'd need until ${feasibleStr} to fit everything — move one to tomorrow?`;
  }
  return '';
}

/**
 * Derives the task id to move to tomorrow from a verdict.
 * For cut-one → the one cut; for multi-cut → the first (largest); for push-deadline → null.
 */
function firstCutId(verdict: PlanVerdict): string | null {
  if (verdict.kind === 'cut-one') return verdict.cut.id;
  if (verdict.kind === 'multi-cut') return verdict.cuts[0]?.id ?? null;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One timeline row. Flat, box-free (Direction A "ghost rail"):
 *   task     — indigo mono clock + semibold ink label + honest duration
 *   event    — a quiet dotted tick + faint clock + calendar glyph + italic label
 *              (read-only meeting; reads as external without any filled box)
 *   breather — a thin centred hairline spacer
 * `focusBandActive` adds a hair-thin indigo left accent to a task that falls
 * inside the learned focus window (no full-bleed band — that was the grey box).
 */
function RowContent({
  item,
  focusBandActive,
}: {
  item: PlanTimelineItem;
  focusBandActive: boolean;
}) {
  const t = useTheme();
  const durationMin = Math.round((item.endAt - item.startAt) / 60_000);

  // Shared geometry so task + event clocks line up to the same x.
  const clockWidth = t.space[10]; // fits "21:00" at mono xs without clipping

  if (item.kind === 'breather') {
    return (
      <View
        style={{ height: t.space[4], alignItems: 'center', justifyContent: 'center' }}
        accessibilityElementsHidden
      >
        <View
          style={{ height: 1, width: t.space[8], backgroundColor: t.colors.hairline, opacity: 0.5 }}
        />
      </View>
    );
  }

  if (item.kind === 'event') {
    const row: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      // Same gap as the task row below — the tick + this gap must sum to the
      // same inset as the task row's edge pill + its gap, or event/task clocks
      // drift apart on the x-axis (see clockWidth comment above).
      gap: t.space[3],
      paddingVertical: t.space[2],
      paddingHorizontal: t.space[3],
      minHeight: t.size.control.sm,
    };
    // Dotted "external" tick — a real flex sibling (not an absolute-positioned
    // overlay measured with `top:'50%'`/negative marginTop). That hack centered
    // against the row's border-box, ignoring how alignItems:'center' centers
    // every other child against the padding box, and its `left` ignored the
    // row's own paddingHorizontal — both caused the visible left-edge drift.
    // Same width as the task row's edge pill (t.row.edgeW) so both row kinds
    // share the same left inset.
    const tickStyle: ViewStyle = {
      width: t.row.edgeW,
      height: 14,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.inkFaint,
      opacity: 0.7,
    };
    const clockStyle: TextStyle = {
      fontFamily: t.fontFamily.mono,
      fontSize: t.fontSize.xs,
      color: t.colors.inkFaint,
      width: clockWidth,
      flexShrink: 0,
    };
    const labelStyle: TextStyle = {
      flex: 1,
      fontSize: t.fontSize.caption,
      color: t.colors.inkSoft,
      fontStyle: 'italic',
    };
    const tagStyle: TextStyle = {
      fontSize: t.fontSize.crumb,
      color: t.colors.inkFaint,
      flexShrink: 0,
      letterSpacing: t.letterSpacing.wide,
    };
    return (
      <View
        style={row}
        testID={`timeline-event-${item.id}`}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Meeting: ${item.label}, ${formatClock(item.startAt)} to ${formatClock(item.endAt)}`}
        accessibilityHint="Read-only calendar event"
      >
        <View style={tickStyle} />
        <AppText style={clockStyle}>{formatClock(item.startAt)}</AppText>
        <Ionicons name="calendar-outline" size={t.iconSize.xs} color={t.colors.inkFaint} />
        <AppText style={labelStyle} numberOfLines={1}>
          {item.label}
        </AppText>
        <AppText style={tagStyle}>{fmtHm(durationMin)}</AppText>
      </View>
    );
  }

  // task
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingVertical: t.space[2],
    paddingHorizontal: t.space[3],
    minHeight: t.size.control.md,
  };
  // Fixed-size pill, not a border — a border-box left border spans the row's
  // full height (border-box model) instead of the intended short accent mark,
  // and only existing when active shifts every other row's content left by
  // edgeW. Always occupy the slot (transparent when inactive) so clock/label/
  // duration stay pixel-aligned across every row regardless of focusBandActive.
  const edgeStyle: ViewStyle = {
    width: t.row.edgeW,
    height: t.row.edgeH,
    borderRadius: t.radii.full,
    backgroundColor: focusBandActive ? t.colors.primary : 'transparent',
  };
  const clockStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: t.colors.primary,
    width: clockWidth,
    flexShrink: 0,
  };
  const labelStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };
  const durationStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    flexShrink: 0,
  };
  return (
    <View
      style={row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${item.label}, starts ${formatClock(item.startAt)}, ${fmtHm(durationMin)}`}
    >
      <View style={edgeStyle} />
      <AppText style={clockStyle}>{formatClock(item.startAt)}</AppText>
      <AppText style={labelStyle} numberOfLines={2}>
        {item.label}
      </AppText>
      <AppText style={durationStyle}>{fmtHm(durationMin)}</AppText>
    </View>
  );
}

/** Calm amber overflow banner — no red, no guilt. */
function OverflowBanner({
  verdict,
  onMove,
}: {
  verdict: PlanVerdict;
  onMove: (id: string) => void;
}) {
  const t = useTheme();
  const cutId = firstCutId(verdict);
  const labelText = overflowLabel(verdict);

  if (!labelText) return null;

  const bannerStyle: ViewStyle = {
    marginHorizontal: t.space[3],
    marginBottom: t.space[3],
    paddingVertical: t.space[2],
    paddingHorizontal: t.space[3],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentSoft,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.accentChip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };

  const labelStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.caption,
    color: t.colors.amberText,
    lineHeight: t.fontSize.caption * t.lineHeight.normal,
  };

  const moveButtonOuter: ViewStyle = {
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[1],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentChip,
    flexShrink: 0,
  };

  const moveButtonText: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.amberText,
  };

  return (
    <View testID="timeline-overflow-banner" style={bannerStyle}>
      <AppText style={labelStyle}>{labelText}</AppText>
      {cutId !== null ? (
        <Pressable
          testID="timeline-move-action"
          onPress={() => onMove(cutId)}
          accessibilityRole="button"
          accessibilityLabel="Move task to tomorrow"
          hitSlop={t.size.hitSlop}
        >
          <View style={moveButtonOuter}>
            <AppText style={moveButtonText}>Move</AppText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The "done by" header chip. Taps open a time-picker ActionSheet (iOS) or a
 * simple list of hour options on Android — no native DateTimePicker dep required.
 */
function DoneByChip({
  doneByMin,
  onSelect,
}: {
  doneByMin: number | null;
  onSelect: (m: number | null) => void;
}) {
  const t = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const label = useMemo(() => {
    if (doneByMin === null) return 'Set done-by time';
    // Compute epoch from LOCAL midnight of today so formatClock reflects
    // the correct local time regardless of UTC offset.
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0);
    return `Done by ${formatClock(localMidnight.getTime() + doneByMin * 60_000)}`;
  }, [doneByMin]);

  const chipStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
    // Android squares rounded corners on press-layer promotion — pin the clip.
    overflow: 'hidden',
    backgroundColor: t.colors.primaryWash,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.primarySoft,
    gap: t.space[1],
  };

  const textStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.primary,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
  };

  // Build a list of half-hour options across the full 24h day so any finish time
  // is reachable (stable — depends on nothing).
  const timeOptions = useMemo<ActionSheetItem[]>(() => {
    const opts: ActionSheetItem[] = [];
    for (let h = 0; h <= 23; h++) {
      for (const m of [0, 30]) {
        const min = h * 60 + m;
        const d = new Date();
        d.setHours(h, m, 0, 0);
        opts.push({ label: formatClockMeridiem(d.getTime()), onPress: () => onSelect(min) });
      }
    }
    return opts;
  }, [onSelect]);

  return (
    <>
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Tap to change your done-by target time"
      >
        <View style={chipStyle}>
          <AppText style={textStyle}>{label}</AppText>
        </View>
      </Pressable>

      <ActionSheet
        visible={pickerOpen}
        title="Done by"
        items={timeOptions}
        onCancel={() => setPickerOpen(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DayTimeline — self-contained; reads useDayPlan internally.
 * The parent screen just renders `<DayTimeline />`.
 */
export function DayTimeline() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // ── Pro guard (defence-in-depth — should be unreachable for free users) ──
  const isPro = useEntitlement((s) => s.isPro);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { plan, status, doneByMin, setDoneBy } = useDayPlan();
  const focusWindow = useLearnedFocusWindow();
  const moveToTomorrow = useDayTasksStore((s) => s.moveToTomorrow);

  const showFocusBand = focusWindow.basis === 'personal';

  // ── Overflow handler ──────────────────────────────────────────────────────
  const handleMoveToTomorrow = useCallback(
    (id: string) => {
      void moveToTomorrow(id);
    },
    [moveToTomorrow],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (status === 'empty' || plan === null) {
    return null;
  }

  // ── Pro guard (defence-in-depth) ──────────────────────────────────────────
  if (!isPro) {
    return null;
  }

  // ── Overflow verdict ──────────────────────────────────────────────────────
  const showOverflow =
    plan.verdict.kind === 'cut-one' ||
    plan.verdict.kind === 'multi-cut' ||
    plan.verdict.kind === 'push-deadline';

  // ── Styles ────────────────────────────────────────────────────────────────
  const containerStyle: ViewStyle = {
    flex: 1,
  };

  const headerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space[3],
    paddingTop: t.space[3],
    paddingBottom: t.space[2],
  };

  const startByStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.mono,
  };

  const scrollStyle: ViewStyle = {
    flex: 1,
  };

  const timelineContainerStyle: ViewStyle = {
    paddingBottom: t.space[8],
    position: 'relative',
  };

  // Focus-window presence marker — a ZERO-PAINT anchor (no grey box). The visible
  // highlight is the hair-thin indigo left-accent on each in-window task row
  // (see RowContent); this invisible node only signals "personal window active".
  const focusBandStyle: ViewStyle = {
    position: 'absolute',
    width: 0,
    height: 0,
    pointerEvents: 'none' as ViewStyle['pointerEvents'],
  };

  // ── Enter animation for rows ──────────────────────────────────────────────
  // Opacity-only fade-in (no translate-in per project hard rules).
  const enterAnim = reducedMotion
    ? undefined
    : FadeIn.duration(t.motion.base);

  return (
    <View style={containerStyle}>
      {/* Header: start-by clock + done-by chip */}
      <View style={headerStyle}>
        {'startBy' in plan.verdict && plan.verdict.startBy ? (
          <AppText style={startByStyle}>
            Start by {formatClock(plan.verdict.startBy)}
          </AppText>
        ) : (
          <View />
        )}
        <DoneByChip doneByMin={doneByMin} onSelect={setDoneBy} />
      </View>

      {/* Overflow banner */}
      {showOverflow ? (
        <OverflowBanner
          verdict={plan.verdict}
          onMove={handleMoveToTomorrow}
        />
      ) : null}

      {/* Timeline rows */}
      <ScrollView
        style={scrollStyle}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={timelineContainerStyle}>
          {/* Focus band — only personal, only behind the list */}
          {showFocusBand ? (
            <FocusBandOverlay bandStyle={focusBandStyle} />
          ) : null}

          {plan.timeline.map((item, idx) => (
            <TimelineRow
              key={item.id}
              item={item}
              index={idx}
              enterAnim={enterAnim}
              focusBandActive={
                showFocusBand &&
                overlapsWindow(
                  epochToLocalMin(item.startAt),
                  epochToLocalMin(item.endAt),
                  focusWindow.startMin,
                  focusWindow.endMin,
                )
              }
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FocusBandOverlay — renders the shaded focus-window band (testID target)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The focus band sits as a View behind the row list when the basis is personal.
 * Renders a full-bleed ambient tint; the per-row content wash (focusBandActive)
 * carries the precise highlight — this component is purely decorative.
 */
function FocusBandOverlay({ bandStyle }: { bandStyle: ViewStyle }) {
  return (
    <View
      testID="timeline-focus-band"
      style={bandStyle}
      pointerEvents="none"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TimelineRow — animated wrapper for one flat row
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineRowProps {
  item: PlanTimelineItem;
  index: number;
  enterAnim: ReturnType<typeof FadeIn.duration> | undefined;
  focusBandActive: boolean;
}

function TimelineRow({ item, index, enterAnim, focusBandActive }: TimelineRowProps) {
  const t = useTheme();

  // Stagger per row — subtle, within budget
  const staggeredAnim = enterAnim
    ? FadeIn.duration(t.motion.base).delay(index * t.motion.stagger)
    : undefined;

  return (
    <Animated.View entering={staggeredAnim} style={{ zIndex: 1 }}>
      <RowContent item={item} focusBandActive={focusBandActive} />
    </Animated.View>
  );
}


