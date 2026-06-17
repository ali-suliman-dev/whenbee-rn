import { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, {
  reorderItems,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { formatClock } from '@/src/lib/time';
import { planBackward } from '@/src/engine';
import { PlanRail } from './PlanRail';
import { PlanTaskCard, type PlanTaskCardProps } from './PlanTaskCard';
import type { usePlanner } from './usePlanner';

// ──────────────────────────────────────────────────────────────────────────────
// RunView — Phase 2 of the Start-By Plan.
//
// Renders when `phase === 'run'` (active plan loaded).
//
// Layout:
//   top bar   — "Today's plan" title + "done by HH:MM · on track ✓" + Abandon slot
//   rail list — done rows (static) + pinned now row + reorderable upcoming rows
//   footer    — ⟳ Re-plan (calls reproject) + ＋ Add task
//
// The now card is NOT inside the ReorderableList (can't be dragged). Done rows
// are also static (not draggable). Only upcoming (`next`) rows are reorderable.
//
// Abandon button: placeholder prop slot — Task 11 will pass the real component.
//
// Timer wiring: onOpenTimer / onStart props on PlanTaskCard are forwarded to
// the parent — Task 12 will connect them to timer navigation.
//
// Breather rows: when active.breatherMin > 0 and a timeline row has kind='breather',
// we render a small breather row using PlanRail with state='breather'.
// ──────────────────────────────────────────────────────────────────────────────

type PlannerHandle = ReturnType<typeof usePlanner>;

// ── Row item shapes ───────────────────────────────────────────────────────────

interface TaskRowItem {
  kind: 'task';
  props: PlanTaskCardProps;
  railTimeLabel: string;
  isFirst: boolean;
  isLast: boolean;
}

interface BreatherRowItem {
  kind: 'breather';
  id: string;
  startAt: number;
  durationMin: number;
  endAt: number;
  isFirst: boolean;
  isLast: boolean;
}

type RunRowItem = TaskRowItem | BreatherRowItem;

// ── Breather row ──────────────────────────────────────────────────────────────

function BreatherRow({
  durationMin,
  endAt,
  isFirst,
  isLast,
}: {
  durationMin: number;
  endAt: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const t = useTheme();
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    columnGap: t.space[2],
    alignItems: 'center',
    marginBottom: t.space[2],
  };
  const labelStyle: TextStyle = {
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.mono,
  };
  return (
    <View style={rowStyle}>
      <PlanRail
        state="breather"
        timeLabel={formatClock(endAt)}
        isFirst={isFirst}
        isLast={isLast}
      />
      <AppText style={labelStyle}>
        {`☕ ${durationMin}m · back at ~${formatClock(endAt)}`}
      </AppText>
    </View>
  );
}

// ── Done row ──────────────────────────────────────────────────────────────────

function DoneRow({
  item,
}: {
  item: TaskRowItem;
}) {
  const t = useTheme();
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    columnGap: t.space[2],
    marginBottom: t.space[2],
  };
  return (
    <View style={rowStyle}>
      <PlanRail
        state="done"
        timeLabel={item.railTimeLabel}
        isFirst={item.isFirst}
        isLast={item.isLast}
      />
      <View style={{ flex: 1 }}>
        <PlanTaskCard {...item.props} />
      </View>
    </View>
  );
}

// ── Now row (pinned) ──────────────────────────────────────────────────────────

function NowRow({
  item,
}: {
  item: TaskRowItem;
}) {
  const t = useTheme();
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    columnGap: t.space[2],
    marginBottom: t.space[2],
  };
  return (
    <View style={rowStyle}>
      <PlanRail
        state="now"
        showNowPill
        isFirst={item.isFirst}
        isLast={item.isLast}
      />
      <View style={{ flex: 1 }}>
        <PlanTaskCard {...item.props} />
      </View>
    </View>
  );
}

// ── Upcoming reorderable item ─────────────────────────────────────────────────
// Rendered by ReorderableList; must be wrapped in a View (not just the card) so
// the rail column is included in the draggable region.

function UpcomingRowItem({ item }: { item: RunRowItem }) {
  const t = useTheme();
  if (item.kind === 'breather') {
    return (
      <BreatherRow
        durationMin={item.durationMin}
        endAt={item.endAt}
        isFirst={item.isFirst}
        isLast={item.isLast}
      />
    );
  }
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    columnGap: t.space[2],
    marginBottom: t.space[2],
  };
  return (
    <View style={rowStyle}>
      <PlanRail
        state="next"
        timeLabel={item.railTimeLabel}
        isFirst={item.isFirst}
        isLast={item.isLast}
      />
      <View style={{ flex: 1 }}>
        <PlanTaskCard {...item.props} />
      </View>
    </View>
  );
}

// ── RunView (main) ────────────────────────────────────────────────────────────

export interface RunViewProps {
  planner: PlannerHandle;
  nowMs?: number;
  /**
   * Slot for the Abandon button — Task 11 will pass the component here.
   * Rendered in the top-bar right slot.
   */
  abandonSlot?: React.ReactNode;
  /** Called when user taps ▶ on an upcoming card (Task 12 wires navigation). */
  onStart?: (taskId: string) => void;
  /** Called when user taps "Open timer" on the now card (Task 12 wires nav). */
  onOpenTimer?: (taskId: string) => void;
  /** Called when user taps ＋ Add task in the footer. */
  onAddTask?: () => void;
}

export function RunView({
  planner,
  nowMs = Date.now(),
  abandonSlot,
  onStart,
  onOpenTimer,
  onAddTask,
}: RunViewProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const { active, runGroups, reorderTasks, reproject, categoryName } = planner;

  // ── Build a full re-projected timeline so we can show accurate start times ──
  const timeline = useMemo(() => {
    if (!active) return [];
    const result = planBackward({
      deadline: active.deadline,
      tasks: active.tasks,
      bufferMin: active.bufferMin,
      nowMs,
    });
    return result.timeline;
  }, [active, nowMs]);

  const timelineByTaskId = useMemo(() => {
    const map = new Map<string, { startAt: number; endAt: number }>();
    for (const entry of timeline) {
      if (entry.kind === 'task') {
        map.set(entry.id, { startAt: entry.startAt, endAt: entry.endAt });
      }
    }
    return map;
  }, [timeline]);

  // ── Derive "done by" time from active plan ──────────────────────────────────
  const doneByMs: number | null = active?.deadline ?? null;

  // ── Build rows for the reorderable "next" section ──────────────────────────
  // includes breather rows interleaved between upcoming tasks.
  const nextRows = useMemo<RunRowItem[]>(() => {
    if (!active) return [];
    const rows: RunRowItem[] = [];
    const nextTasks = runGroups.next;

    for (let i = 0; i < nextTasks.length; i++) {
      const task = nextTasks[i];
      if (!task) continue;

      // Insert a breather row before this task if needed and breatherMin > 0.
      // We find the preceding timeline entry to see if there's a breather between.
      if (active.breatherMin > 0 && i > 0) {
        // Find breather slot in the timeline between the previous task and this one
        const prevTask = nextTasks[i - 1];
        if (prevTask) {
          const prevEntry = timelineByTaskId.get(prevTask.id);
          const thisEntry = timelineByTaskId.get(task.id);
          if (prevEntry && thisEntry && thisEntry.startAt > prevEntry.endAt) {
            const breatherDuration = Math.round(
              (thisEntry.startAt - prevEntry.endAt) / 60000,
            );
            if (breatherDuration > 0) {
              rows.push({
                kind: 'breather',
                id: `breather-before-${task.id}`,
                startAt: prevEntry.endAt,
                durationMin: breatherDuration,
                endAt: thisEntry.startAt,
                isFirst: false,
                isLast: false,
              });
            }
          }
        }
      }

      const timeEntry = timelineByTaskId.get(task.id);
      rows.push({
        kind: 'task',
        props: {
          variant: 'run' as const,
          id: task.id,
          label: task.label,
          category: categoryName(task.category),
          durationMin: task.durationMin,
          startAt: timeEntry?.startAt,
          endAt: timeEntry?.endAt,
          runStatus: 'upcoming',
          onStart,
        },
        railTimeLabel:
          timeEntry !== undefined ? formatClock(timeEntry.startAt) : '',
        isFirst: false,
        isLast: false,
      });
    }
    return rows;
  }, [active, runGroups.next, timelineByTaskId, categoryName, onStart]);

  // ── Total row count for first/last flags ────────────────────────────────────
  const doneCount = runGroups.done.length;
  const hasNow = runGroups.now.length > 0;
  const totalRows = doneCount + (hasNow ? 1 : 0) + nextRows.length;

  // ── Reorder handler (only next tasks) ──────────────────────────────────────
  // Extracts the task-only ids (skipping breather entries) and reorders them.
  const handleReorder = useCallback(
    (event: ReorderableListReorderEvent) => {
      const taskRowIndices: number[] = [];
      for (let i = 0; i < nextRows.length; i++) {
        if (nextRows[i]?.kind === 'task') taskRowIndices.push(i);
      }
      const taskIds = taskRowIndices
        .map((i) => {
          const row = nextRows[i];
          return row?.kind === 'task' ? row.props.id : undefined;
        })
        .filter((id): id is string => id !== undefined);

      // Map the event indices to task-only positions
      const reordered = reorderItems(taskIds, event.from, event.to);
      // Combine with done + now ids to produce full task list order
      const doneIds = runGroups.done.map((t) => t.id);
      const nowIds = runGroups.now.map((t) => t.id);
      reorderTasks([...doneIds, ...nowIds, ...reordered]);
    },
    [nextRows, runGroups.done, runGroups.now, reorderTasks],
  );

  const renderNextRow = useCallback(
    ({ item }: { item: RunRowItem }) => <UpcomingRowItem item={item} />,
    [],
  );

  const keyExtractorNext = useCallback((item: RunRowItem) => {
    return item.kind === 'task' ? item.props.id : item.id;
  }, []);

  // ── Re-plan handler ─────────────────────────────────────────────────────────
  const handleReplan = useCallback(() => {
    reproject(active);
  }, [reproject, active]);

  // ── Layout tokens ───────────────────────────────────────────────────────────
  const screenPad: ViewStyle = { paddingHorizontal: t.space[4] };

  const topBarStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: t.space[2],
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.title,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
    letterSpacing: t.letterSpacing.tight,
  };

  const metaStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };

  const metaValueStyle: TextStyle = {
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };

  const footerStyle: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[2],
    paddingHorizontal: t.space[4],
    paddingTop: t.space[2],
    paddingBottom: Math.max(insets.bottom, t.space[4]),
  };

  const ghostBtnStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[2],
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    borderRadius: t.radii.md,
    paddingVertical: t.space[3],
  };

  const ghostBtnLabelStyle: TextStyle = {
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.ink,
  };

  if (!active) return null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top bar ── */}
        <View style={[screenPad, topBarStyle]}>
          <View>
            <AppText style={titleStyle}>{"Today’s plan"}</AppText>
            {doneByMs !== null ? (
              <AppText style={metaStyle}>
                {'done by '}
                <AppText style={metaValueStyle}>{formatClock(doneByMs)}</AppText>
                {' · on track ✓'}
              </AppText>
            ) : null}
          </View>

          {/* ── Abandon slot — Task 11 passes the component here ── */}
          {abandonSlot ?? null}
        </View>

        {/* ── Rail list ── */}
        <View style={[screenPad, { marginTop: t.space[3] }]}>

          {/* Done rows */}
          {runGroups.done.map((task, i) => {
            const timeEntry = timelineByTaskId.get(task.id);
            const rowIndex = i;
            const isLast =
              rowIndex === totalRows - 1;
            return (
              <DoneRow
                key={task.id}
                item={{
                  kind: 'task',
                  props: {
                    variant: 'run',
                    id: task.id,
                    label: task.label,
                    category: categoryName(task.category),
                    durationMin: task.durationMin,
                    startAt: timeEntry?.startAt,
                    endAt: timeEntry?.endAt,
                    runStatus: 'done',
                    actualMin: task.actualMin,
                  },
                  railTimeLabel:
                    timeEntry !== undefined
                      ? formatClock(timeEntry.startAt)
                      : '',
                  isFirst: rowIndex === 0,
                  isLast,
                }}
              />
            );
          })}

          {/* Now row — pinned, no drag */}
          {runGroups.now.map((task, i) => {
            const timeEntry = timelineByTaskId.get(task.id);
            const rowIndex = doneCount + i;
            const isLast = rowIndex === totalRows - 1;

            // Compute progress from elapsed time vs planned duration.
            // We use the task's timeline startAt as the wall-clock start proxy.
            const taskStart = timeEntry?.startAt;
            const elapsedMs = taskStart !== undefined ? Math.max(0, nowMs - taskStart) : 0;
            const plannedMs = task.durationMin * 60 * 1000;
            const computedProgress = plannedMs > 0 ? elapsedMs / plannedMs : 0;

            return (
              <NowRow
                key={task.id}
                item={{
                  kind: 'task',
                  props: {
                    variant: 'run',
                    id: task.id,
                    label: task.label,
                    category: categoryName(task.category),
                    durationMin: task.durationMin,
                    startAt: timeEntry?.startAt,
                    endAt: timeEntry?.endAt,
                    runStatus: 'running',
                    progress: computedProgress,
                    onOpenTimer,
                  },
                  railTimeLabel: '',
                  isFirst: rowIndex === 0,
                  isLast,
                }}
              />
            );
          })}

          {/* Upcoming rows — reorderable */}
          {nextRows.length > 0 ? (
            <ReorderableList
              data={nextRows}
              keyExtractor={keyExtractorNext}
              renderItem={renderNextRow}
              onReorder={handleReorder}
              scrollEnabled={false}
            />
          ) : null}
        </View>

        <View style={{ flex: 1 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={footerStyle}>
        <Pressable
          style={ghostBtnStyle}
          onPress={handleReplan}
          accessibilityRole="button"
          accessibilityLabel="Re-plan — recalculate your timeline from now"
        >
          <AppText style={ghostBtnLabelStyle}>⟳  Re-plan</AppText>
        </Pressable>
        <Pressable
          style={ghostBtnStyle}
          onPress={onAddTask}
          accessibilityRole="button"
          accessibilityLabel="Add a task to your plan"
        >
          <AppText style={ghostBtnLabelStyle}>＋  Add task</AppText>
        </Pressable>
      </View>
    </View>
  );
}
