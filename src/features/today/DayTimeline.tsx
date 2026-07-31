/**
 * DayTimeline — renders the computed day plan as a vertical timeline.
 *
 * Reads useDayPlan internally (self-contained, no props needed for the plan).
 * Renders:
 *   - 'task' items: start clock + label + honest duration
 *   - 'event' items: greyed, read-only meeting block (non-interactive)
 *   - 'breather' items: a thin gap spacer
 *   - 'overflow' items: a queued task the day had no room for, rendered IN PLACE
 *     below a done-by boundary rule — flat amber card, "+Nm over", Tomorrow chip.
 *     Ordinary draggable cells; drag one up and the engine re-runs.
 *   - Learned focus-window band behind rows that fall inside it (personal only)
 *   - Header chip: "done by {time}" → opens a time picker → setDoneBy
 *
 * Motion: rows fade in via entering-only opacity (no bounce / translate-in).
 * Reduced-motion → final state. reactCompiler Pressable gotcha: visual styles on
 * inner View, Pressable is a bare touch wrapper.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  useReducedMotion,
} from 'react-native-reanimated';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
  type ReorderableListRenderItemInfo,
} from 'react-native-reorderable-list';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useDayPlan, localMidnight } from './useDayPlan';
import { Trans, useTranslation } from 'react-i18next';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { FinishEditorSheet } from '@/src/features/routines/FinishEditorSheet';
import { formatClock, fmtHm } from '@/src/lib/time';
import { formatDuration } from '@/src/i18n/formatDuration';
import type { PlanTimelineItem } from '@/src/domain/types';

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
 * True for the rows the user owns and can drag: their tasks, whether or not the
 * day had room for them. An overflow block is an ordinary cell — same grip, same
 * drag, same drop — because a task that ran past the done-by is exactly the one
 * you most want to move.
 */
function isDraggable(item: PlanTimelineItem): boolean {
  return item.kind === 'task' || item.kind === 'overflow';
}

/** Stable id-string of a timeline's task order — the reorder identity we compare
 *  the optimistic override against (see the optimistic-reorder block below).
 *  Overflow rows count: they carry an orderIndex like any other task, and leaving
 *  them out would let the override compare equal while the queue still differs. */
function queueOrderKey(items: readonly PlanTimelineItem[]): string {
  return items
    .filter(isDraggable)
    .map((i) => i.id)
    .join('|');
}

/** Index of the first row that runs past the done-by, or -1 when the day fits. */
function firstOverflowIndex(items: readonly PlanTimelineItem[]): number {
  return items.findIndex((i) => i.kind === 'overflow');
}

/**
 * The done-by boundary as a list row of its own.
 *
 * It used to render INSIDE the first overflow cell, which meant the reorder list
 * lifted the amber rule and its sentence along with the card the user grabbed —
 * you appeared to be dragging a paragraph. As its own row it stays put while a
 * card travels over it.
 *
 * It is never draggable (only `isDraggable` rows expose a grip) and it is never
 * persisted: `handleReorder` strips it before writing the optimistic order, and
 * the row is re-inserted from the freshly computed boundary index on the next
 * render — so a drop moves the line to whichever row is now first past the
 * done-by, exactly as before.
 */
const BOUNDARY_ROW_ID = '__done_by_boundary__';

interface BoundaryRow {
  kind: 'boundary';
  id: typeof BOUNDARY_ROW_ID;
  doneByMs: number;
  overrunFinishMs: number;
}

type TimelineListRow = PlanTimelineItem | BoundaryRow;

const isBoundaryRow = (row: TimelineListRow): row is BoundaryRow => row.kind === 'boundary';

/** Drop the synthetic boundary row, leaving a pure plan timeline. */
function stripBoundary(rows: readonly TimelineListRow[]): PlanTimelineItem[] {
  return rows.filter((r): r is PlanTimelineItem => !isBoundaryRow(r));
}

/**
 * Insert the boundary row above `index`. A negative index means either the
 * day fits, or there's no finish target to draw a boundary against — the
 * caller passes -1 for both (see the `hasFinishTarget` guard at the call
 * site).
 */
function withBoundary(
  rows: readonly PlanTimelineItem[],
  index: number,
  doneByMs: number | null,
  overrunFinishMs: number,
): TimelineListRow[] {
  if (index < 0 || doneByMs === null) return [...rows];
  const out: TimelineListRow[] = [...rows];
  out.splice(index, 0, { kind: 'boundary', id: BOUNDARY_ROW_ID, doneByMs, overrunFinishMs });
  return out;
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
  overMin,
  hasFinishTarget,
  onMoveToTomorrow,
  onDragHandleLongPress,
}: {
  item: PlanTimelineItem;
  focusBandActive: boolean;
  /** Minutes this block ends past the done-by. Only meaningful for overflow rows. */
  overMin: number;
  /** Whether the user actually set a finish time — see the boundary-row gate
   *  in DayTimeline. Only affects this row's accessibility copy: an overflow
   *  row with no chosen finish reads against "when today ends", never "your
   *  done-by time" (there isn't one). */
  hasFinishTarget: boolean;
  onMoveToTomorrow: (id: string) => void;
  /** Present only for draggable rows — long-press on the grip starts the drag. */
  onDragHandleLongPress?: () => void;
}) {
  const t = useTheme();
  const { t: translate } = useTranslation();
  const { t: tr } = useTranslation('today');
  const durationMin = Math.round((item.endAt - item.startAt) / 60_000);
  const durationLabel = formatDuration(durationMin, translate);

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
        accessibilityLabel={tr('dayTimeline.meetingA11y', {
          label: item.label,
          start: formatClock(item.startAt),
          end: formatClock(item.endAt),
        })}
        accessibilityHint={tr('dayTimeline.meetingA11yHint')}
      >
        <View style={tickStyle} />
        <AppText style={clockStyle}>{formatClock(item.startAt)}</AppText>
        <Ionicons name="calendar-outline" size={t.iconSize.xs} color={t.colors.inkFaint} />
        <AppText style={labelStyle} numberOfLines={1}>
          {item.label}
        </AppText>
        <AppText style={tagStyle}>{durationLabel}</AppText>
      </View>
    );
  }

  if (item.kind === 'overflow') {
    // A task the day had no room for, shown IN PLACE rather than named in a
    // banner or dropped in silence. Structurally identical to a task row — same
    // grip, same type scale, same card geometry — so the only thing that changes
    // as a row crosses the boundary is its colour. FLAT tinted card: no left
    // border, no inset edge, nothing that reads as an alert stripe.
    const block: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.space[3],
      paddingVertical: t.space[2],
      paddingHorizontal: t.space[3],
      minHeight: t.size.control.md,
      backgroundColor: t.colors.accentChip,
      borderRadius: t.radii.md,
      borderCurve: 'continuous',
      marginHorizontal: t.space[2],
      marginVertical: t.space[0.5],
    };
    const textColumn: ViewStyle = { flex: 1, gap: t.space[0.5] };
    const titleStyle: TextStyle = {
      fontSize: t.fontSize.bodySm,
      fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
      color: t.colors.amberText,
    };
    const metaStyle: TextStyle = {
      fontSize: t.fontSize.xs,
      color: t.colors.inkSoft,
    };
    const chipFace: ViewStyle = {
      paddingHorizontal: t.space[2],
      paddingVertical: t.space[1],
      borderRadius: t.radii.full,
      // Android squares rounded corners on press-layer promotion — pin the clip.
      overflow: 'hidden',
      backgroundColor: t.colors.accentSoft,
      flexShrink: 0,
    };
    const chipText: TextStyle = {
      fontSize: t.fontSize.xs,
      fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
      color: t.colors.amberText,
    };
    const overLabel = `+${fmtHm(overMin)} over`;

    return (
      <View
        style={block}
        testID={`timeline-overflow-${item.id}`}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          hasFinishTarget
            ? `${item.label}, runs ${fmtHm(overMin)} past your done-by time`
            : `${item.label}, runs ${fmtHm(overMin)} past when today ends`
        }
      >
        {onDragHandleLongPress ? (
          <Pressable
            testID={`timeline-drag-handle-${item.id}`}
            onLongPress={onDragHandleLongPress}
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${item.label}`}
            accessibilityHint={tr('timeline.reorderHint')}
            hitSlop={t.size.hitSlop}
          >
            <MaterialCommunityIcons
              name="drag-vertical"
              size={t.iconSize.md}
              color={t.colors.inkSoft}
            />
          </Pressable>
        ) : null}
        <View style={textColumn}>
          <AppText style={titleStyle} numberOfLines={2}>
            {item.label}
          </AppText>
          <AppText style={metaStyle}>{overLabel}</AppText>
        </View>
        <Pressable
          testID={`timeline-move-tomorrow-${item.id}`}
          onPress={() => onMoveToTomorrow(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Move ${item.label} to tomorrow`}
          hitSlop={t.size.hitSlop}
        >
          <View style={chipFace}>
            <AppText style={chipText}>{tr('timeline.tomorrowChip')}</AppText>
          </View>
        </Pressable>
      </View>
    );
  }

  // task — a draggable "card": a darker recessed fill + rounded inset so it reads
  // as a movable item distinct from the read-only event rows (which stay flat).
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingVertical: t.space[2],
    paddingHorizontal: t.space[3],
    minHeight: t.size.control.md,
    backgroundColor: t.colors.taskCardBg,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    marginHorizontal: t.space[2],
    marginVertical: t.space[0.5],
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
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    // Brighter indigo than the base primary — Android's `monospace` family
    // ignores the bold weight, so emphasis comes from the colour on that OS.
    color: t.colors.primaryBright,
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
      accessibilityLabel={tr('dayTimeline.taskA11y', {
        label: item.label,
        start: formatClock(item.startAt),
        duration: durationLabel,
      })}
    >
      {onDragHandleLongPress ? (
        <Pressable
          testID={`timeline-drag-handle-${item.id}`}
          onLongPress={onDragHandleLongPress}
          accessibilityRole="button"
          accessibilityLabel={`Reorder ${item.label}`}
          accessibilityHint={tr('timeline.reorderHint')}
          hitSlop={t.size.hitSlop}
        >
          <MaterialCommunityIcons
            name="drag-vertical"
            size={t.iconSize.md}
            color={t.colors.inkSoft}
          />
        </Pressable>
      ) : null}
      <View style={edgeStyle} />
      <AppText style={clockStyle}>{formatClock(item.startAt)}</AppText>
      <AppText style={labelStyle} numberOfLines={2}>
        {item.label}
      </AppText>
      <AppText style={durationStyle}>{durationLabel}</AppText>
    </View>
  );
}

/**
 * The done-by boundary: a mono clock, a faint amber rule, and one sentence naming
 * both ways out. It is a READOUT of where the day starts running over, not a wall
 * — it sits above whichever row is first past the deadline, so dragging a task up
 * moves the line up with it rather than refusing the drop.
 *
 * No banner, no alert, no icon. Amber, never red: running long is a fact.
 */
function OverflowBoundary({
  doneByMs,
  overrunFinishMs,
}: {
  doneByMs: number;
  overrunFinishMs: number;
}) {
  const t = useTheme();

  const wrapStyle: ViewStyle = {
    paddingHorizontal: t.space[3],
    paddingTop: t.space[4],
    paddingBottom: t.space[2],
    gap: t.space[2],
  };

  const ruleRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
  };

  // amberText, not the raw accent: #EEAE4D on the light surface is ~1.9:1 and
  // unreadable at this size. amberText IS the accent in dark mode and its AA-safe
  // sibling in light, so the label reads as amber on both without going murky.
  const labelStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: t.colors.amberText,
    letterSpacing: t.letterSpacing.wide,
    flexShrink: 0,
  };

  const ruleStyle: ViewStyle = {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.colors.accentLine,
  };

  const sentenceStyle: TextStyle = {
    fontSize: t.fontSize.caption,
    color: t.colors.inkSoft,
    lineHeight: t.fontSize.caption * t.lineHeight.normal,
  };

  const clockStyle: TextStyle = { color: t.colors.ink };

  const overrunClock = formatClock(overrunFinishMs);

  return (
    <View style={wrapStyle} testID="timeline-overflow-boundary">
      <View style={ruleRowStyle}>
        <AppText style={labelStyle}>{`${formatClock(doneByMs)} DONE BY`}</AppText>
        <View style={ruleStyle} />
      </View>
      <AppText style={sentenceStyle}>
        <Trans
          i18nKey="timeline.overrunSentence"
          ns="today"
          values={{ clock: overrunClock }}
          components={{ clock: <AppText style={clockStyle} /> }}
        />
      </AppText>
    </View>
  );
}

/**
 * The "done by" header chip. Taps open the FinishTimeWheel sheet — a two-column
 * HH:MM wheel that also flips into a tap-to-type keypad for typing any minute.
 */
function DoneByChip({
  doneByMin,
  onSelect,
}: {
  doneByMin: number | null;
  onSelect: (m: number | null) => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Epoch from LOCAL midnight of today so formatClock/FinishTimeWheel reflect
  // the correct local time regardless of UTC offset.
  const localMidnightMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const label = useMemo(() => {
    if (doneByMin === null) return tr('timeline.setDoneBy');
    return tr('timeline.doneBy', { clock: formatClock(localMidnightMs + doneByMin * 60_000) });
  }, [doneByMin, localMidnightMs, tr]);

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

  const valueMs = doneByMin === null ? null : localMidnightMs + doneByMin * 60_000;

  const handleChange = useCallback(
    (ms: number) => {
      onSelect(Math.round((ms - localMidnightMs) / 60_000));
    },
    [onSelect, localMidnightMs],
  );

  return (
    <>
      <Pressable
        onPress={() => setPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={tr('dayTimeline.doneBy.hint')}
      >
        <View style={chipStyle}>
          <AppText style={textStyle}>{label}</AppText>
        </View>
      </Pressable>

      <FinishEditorSheet
        visible={pickerOpen}
        valueMs={valueMs}
        onChange={handleChange}
        onClear={() => {
          onSelect(null);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export interface DayTimelineProps {
  /**
   * Skip rendering the internal start-by/done-by header block — rows only.
   * The plan sheet (`(modals)/plan.tsx`) owns that header itself so it can
   * pad it below the grabber and pair it with a justified finish-by clock.
   */
  hideHeader?: boolean;
}

/**
 * DayTimeline — self-contained; reads useDayPlan internally.
 * The parent screen just renders `<DayTimeline />`.
 */
export function DayTimeline({ hideHeader = false }: DayTimelineProps = {}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // ── Pro guard (defence-in-depth — should be unreachable for free users) ──
  const isPro = useEntitlement((s) => s.isPro);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { plan, status, doneByMin, hasFinishTarget, setDoneBy, planAnchor } = useDayPlan();
  const focusWindow = useLearnedFocusWindow();
  const moveToTomorrow = useDayTasksStore((s) => s.moveToTomorrow);
  const reorderTasks = useDayTasksStore((s) => s.reorderTasks);
  const selectedDate = useDayTasksStore((s) => s.selectedDate);

  // ── Optimistic reorder order (kills the drop "flash") ─────────────────────
  // On drop, react-native-reorderable-list expects the list `data` to reflect
  // the new order immediately. Ours comes from useDayPlan, which only updates
  // AFTER reorderTasks persists + the store reloads + the engine re-derives — so
  // without this the dropped row snaps back to its old slot and jumps once the
  // async round-trip lands (the visible flash). We hold the just-dropped order
  // locally and render it instantly; the persist runs in the background. The
  // override clears once the real plan's task order catches up to ours — compared
  // by a stable id STRING, never the plan object: useDayPlan recomputes a fresh
  // plan every render off Date.now(), so a ref check would clear the override the
  // very next frame and the flash would come back.
  const [optimisticTimeline, setOptimisticTimeline] = useState<PlanTimelineItem[] | null>(null);
  const displayTimeline = optimisticTimeline ?? plan?.timeline ?? null;
  const planOrderKey = plan ? queueOrderKey(plan.timeline) : '';
  const optimisticOrderKey = optimisticTimeline ? queueOrderKey(optimisticTimeline) : null;
  useEffect(() => {
    if (optimisticOrderKey !== null && optimisticOrderKey === planOrderKey) {
      setOptimisticTimeline(null);
    }
  }, [optimisticOrderKey, planOrderKey]);

  const showFocusBand = focusWindow.basis === 'revealed';

  // ── Overflow handler ──────────────────────────────────────────────────────
  const handleMoveToTomorrow = useCallback(
    (id: string) => {
      void moveToTomorrow(id);
    },
    [moveToTomorrow],
  );

  // ── Drag-to-reorder handler ────────────────────────────────────────────────
  // The list's `data` is the FULL timeline (task/event/breather, mixed) so
  // fixed event/breather anchors visually make room during a drag like any
  // other row. Only 'task' rows can INITIATE a drag (see TimelineRow's grip),
  // so `from` is always a task index; `to` may land anywhere in the mixed
  // array. We don't persist the reordered mixed array — we derive the new
  // TASK-id order from it (ignoring event/breather positions, which the
  // planner recomputes from anchors on the next render) and hand that to the
  // store; useDayPlan then re-derives the real timeline positions.
  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      const current = listDataRef.current;
      if (!current) return;
      // `from`/`to` index the list INCLUDING the synthetic boundary row, so the
      // move is applied there and the row dropped afterwards — never persisted,
      // never counted in the task order.
      const reordered = stripBoundary(reorderItems(current, from, to));
      // Show the new order instantly — no wait for the async store round-trip…
      setOptimisticTimeline(reordered);
      // …then persist. useDayPlan re-derives the real clocks; once its task order
      // matches this one, the effect above drops the override seamlessly.
      // Overflow rows are included: they are queued tasks with an orderIndex, and
      // dropping them here would silently shove them back to the end of the day.
      const taskIds = reordered.filter(isDraggable).map((item) => item.id);
      void reorderTasks(taskIds);
    },
    [reorderTasks],
  );

  // ── Enter animation for rows ──────────────────────────────────────────────
  // Opacity-only fade-in (no translate-in per project hard rules) — but ONLY on
  // the first mount. react-native-reorderable-list swaps its whole `data` array
  // on a drop, which re-mounts cells and REPLAYS a per-row `entering` animation —
  // that replay is the "flash" on reorder. We let the fade play once, then drop
  // the entering prop so a reorder just glides (the library animates the move).
  const [entrancesDone, setEntrancesDone] = useState(false);
  useEffect(() => {
    // Upper bound for the initial staggered fade to finish (base + a few steps).
    const id = setTimeout(() => setEntrancesDone(true), t.motion.base + 12 * t.motion.stagger);
    return () => clearTimeout(id);
  }, [t.motion.base, t.motion.stagger]);
  const enterAnim = reducedMotion || entrancesDone ? undefined : FadeIn.duration(t.motion.base);

  // ── Where the day runs over ───────────────────────────────────────────────
  // The done-by clock is the user's OWN choice (doneByMin), never inferred from
  // a row: the engine's overflow chain reseeds the first overflow block's
  // startAt to max(latestEnd, deadline, nowMs) so it can never land in the
  // past, which means that row's clock stops being the deadline once "now" has
  // passed it — reading it as the boundary would show the current time
  // labelled "DONE BY". doneByMin is a minute-of-day, so it's anchored to
  // today's local midnight the same way DoneByChip turns it into a clock.
  // The furthest overflow end is still read off the rows — that one IS the
  // real finish the sentence offers to push to, and reading it from the
  // rendered list (not the plan) is what makes it follow an optimistic drop
  // in the same frame.
  // The exact array handed to the list this render, boundary row included: the
  // reorder event's from/to index into THIS, not into the plan timeline.
  const listDataRef = useRef<TimelineListRow[]>([]);

  const rows = displayTimeline ?? [];
  const boundaryIndex = firstOverflowIndex(rows);
  const doneByMs =
    hasFinishTarget && doneByMin !== null
      ? localMidnight(selectedDate) + doneByMin * 60_000
      : null;
  const overrunFinishMs = rows.reduce(
    (latest, item) => (item.kind === 'overflow' ? Math.max(latest, item.endAt) : latest),
    0,
  );

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: ReorderableListRenderItemInfo<TimelineListRow>) =>
      isBoundaryRow(item) ? (
        <OverflowBoundary doneByMs={item.doneByMs} overrunFinishMs={item.overrunFinishMs} />
      ) : (
      <TimelineRow
        item={item}
        index={index}
        enterAnim={enterAnim}
        overMin={doneByMs === null ? 0 : Math.round((item.endAt - doneByMs) / 60_000)}
        hasFinishTarget={hasFinishTarget}
        onMoveToTomorrow={handleMoveToTomorrow}
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
      ),
    [
      enterAnim,
      showFocusBand,
      focusWindow.startMin,
      focusWindow.endMin,
      doneByMs,
      hasFinishTarget,
      handleMoveToTomorrow,
    ],
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (status === 'empty' || plan === null) {
    return null;
  }

  // ── Pro guard (defence-in-depth) ──────────────────────────────────────────
  if (!isPro) {
    return null;
  }

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

  // boundaryIndex/doneByMs are read off `rows` (the displayed timeline). With no
  // display timeline yet they are -1/null, so no boundary row is inserted — the
  // same as the old in-cell `index === boundaryIndex` test never matching.
  // The boundary row itself only draws when the user actually set a finish
  // time: it names a "done by" deadline, and there isn't one to name when
  // hasFinishTarget is false — the overflow cards still render (see
  // isDraggable / RowContent's overflow branch), just without that readout.
  const listData = withBoundary(
    displayTimeline ?? plan.timeline,
    hasFinishTarget ? boundaryIndex : -1,
    doneByMs,
    overrunFinishMs,
  );
  listDataRef.current = listData;

  return (
    <View style={containerStyle}>
      {/* Header: start-by/starting clock + done-by chip. A 'start'-anchored plan's
          clock is a derived first-block start, not a deadline — worded "Starting"
          to match, never "Start by" (see (modals)/plan.tsx's footer, worded the
          same way). */}
      {!hideHeader ? (
        <View style={headerStyle}>
          {'startBy' in plan.verdict && plan.verdict.startBy ? (
            <AppText style={startByStyle}>
              {planAnchor === 'start' ? 'Starting' : 'Start by'}{' '}
              {formatClock(plan.verdict.startBy)}
            </AppText>
          ) : (
            <View />
          )}
          <DoneByChip doneByMin={doneByMin} onSelect={setDoneBy} />
        </View>
      ) : null}

      {/* Timeline rows — a reorderable FlatList. Only task rows expose a grip
          (see RowContent) that starts a drag via long-press; event/breather
          rows have no grip and never initiate one. */}
      <ReorderableList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onReorder={handleReorder}
        style={scrollStyle}
        contentContainerStyle={timelineContainerStyle}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        // This list is the plan formSheet's scroll container. A list can't use
        // <SheetScrollView>, so it takes the same invariant directly (the prop is
        // not in ReorderableList's OmittedProps, so it reaches the underlying
        // ScrollView): without it the Android sheet's BottomSheetBehavior finds no
        // scrolling child and a downward drag dismisses the sheet. See
        // SheetScrollView for the full mechanism.
        nestedScrollEnabled
        ListHeaderComponent={
          // Focus band — only personal, only behind the list
          showFocusBand ? <FocusBandOverlay bandStyle={focusBandStyle} /> : null
        }
      />
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
  overMin: number;
  hasFinishTarget: boolean;
  onMoveToTomorrow: (id: string) => void;
}

function TimelineRow({
  item,
  index,
  enterAnim,
  focusBandActive,
  overMin,
  hasFinishTarget,
  onMoveToTomorrow,
}: TimelineRowProps) {
  const t = useTheme();
  // Hooks are unconditional (rules-of-hooks) — every row gets a drag trigger,
  // but only task/overflow rows render the grip that wires it up (see
  // RowContent), so event/breather rows can never initiate a drag.
  const drag = useReorderableDrag();

  // Stagger per row — subtle, within budget
  const staggeredAnim = enterAnim
    ? FadeIn.duration(t.motion.base).delay(index * t.motion.stagger)
    : undefined;

  return (
    <Animated.View entering={staggeredAnim} style={{ zIndex: 1 }}>
      <RowContent
        item={item}
        focusBandActive={focusBandActive}
        overMin={overMin}
        hasFinishTarget={hasFinishTarget}
        onMoveToTomorrow={onMoveToTomorrow}
        onDragHandleLongPress={isDraggable(item) ? drag : undefined}
      />
    </Animated.View>
  );
}


