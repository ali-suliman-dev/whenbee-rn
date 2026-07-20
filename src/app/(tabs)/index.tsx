import { View, Text, Pressable, ScrollView, RefreshControl, type TextStyle } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useToday, type TodayRow } from '@/src/features/today/useToday';
import { FocusCard } from '@/src/features/today/FocusCard';
import { RunningFocusCard } from '@/src/features/today/RunningFocusCard';
import { TaskRow } from '@/src/features/today/TaskRow';
import { DoneSection } from '@/src/features/today/DoneSection';
import { TodayHeaderRing } from '@/src/features/today/TodayHeaderRing';
import { leadHoney } from '@/src/features/today/leadHoney';
import { RitualSeal } from '@/src/features/today/RitualSeal';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';
import { QuickTaskChips } from '@/src/components/quick/QuickTaskChips';
import { ActionSheet, type ActionSheetItem } from '@/src/components/ActionSheet';
import { canEditRow } from '@/src/features/today/canEditRow';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { projectedFinish, formatClockMeridiem, formatClock } from '@/src/lib/time';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { toLocalDayKey, addDays, weekdayOf, compareDayKeys } from '@/src/lib/day';
import { kv } from '@/src/lib/kv';
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
import { useGreeting } from '@/src/features/today/useGreeting';
import { TodayFocusHook } from '@/src/features/today/TodayFocusHook';
import { CalendarStrip } from '@/src/features/today/calendarStrip/CalendarStrip';
import { PlanButton } from '@/src/features/today/PlanButton';
import { ShelfSection } from '@/src/features/today/ShelfSection';
import { DayRecapCard } from '@/src/features/today/DayRecapCard';
import { useDayRecap } from '@/src/features/today/useDayRecap';
import { CapacityChip } from '@/src/features/today/CapacityChip';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { useCapacityWidgetPublisher } from '@/src/features/today/useCapacityWidgetPublisher';
import { useBiasWidgetPublisher } from '@/src/features/today/useBiasWidgetPublisher';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useScheduledRoutines } from '@/src/features/today/useScheduledRoutines';
import { ScheduledRoutineBlock } from '@/src/features/today/ScheduledRoutineBlock';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByReminder } from '@/src/features/today/useStartByReminder';

// Date label for a day-key, e.g. "Fri · Jun 12" — the day + date, no clock.
function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const day = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${monthDay}`;
}

/** Full weekday name for the header title when a non-today day is selected. */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function weekdayName(key: string): string {
  return WEEKDAY_NAMES[weekdayOf(key)] ?? 'Today';
}

export default function Today() {
  const t = useTheme();
  const {
    focus,
    summary,
    upNext,
    done,
    totalCount,
    categoryName,
    companionStage,
    companionSeed,
    hasEverLogged,
  } = useToday();
  const selectedDate = useDayTasksStore((s) => s.selectedDate);
  const dayMeta = useDayTasksStore((s) => s.dayMeta);
  const markPlanned = useDayTasksStore((s) => s.markPlanned);
  const isPro = useEntitlement((s) => s.isPro);
  const today = toLocalDayKey(Date.now());
  const isPastDay = compareDayKeys(selectedDate, today) < 0;
  const isToday = selectedDate === today;

  // Scheduled routine blocks for the selected day — derived read, no DB writes.
  // Only shown on today/future days (past days use DayRecapCard).
  const { blocks: scheduledRoutineBlocks } = useScheduledRoutines(selectedDate);
  const headerTitle = selectedDate === today ? 'Today' : weekdayName(selectedDate);
  const headerSubtitle = dateLabel(selectedDate);

  // Day plan — read here for the plan-entry strip + the export wire. DayTimeline
  // re-reads it inside the sheet.
  const { plan: dayPlan, status: planStatus } = useDayPlan();

  // Fire the opt-in "start by" reminder off the live plan (no-op unless both the
  // reminders + start-by toggles are on and the start-by is still in the future).
  useStartByReminder(dayPlan);

  // Recap for past days — null when today or future.
  const recap = useDayRecap();

  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskId = useTimerStore((s) => s.taskId);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const quickStartEnabled = useSettingsStore((s) => s.quickStartEnabled);
  const removeTask = useDayTasksStore((s) => s.removeTask);
  const shelfTasks = useDayTasksStore((s) => s.shelfTasks);

  // Keep the shelf fresh: load on mount and whenever tasks change.
  useEffect(() => {
    void useDayTasksStore.getState().loadShelf();
  }, [totalCount]);

  // First-run coach: teach the long-press row-actions gesture once, then never
  // again. Shown on the first queued row only.
  const [showLongPressHint, setShowLongPressHint] = useState(
    () => kv.getString('today.seenLongPressHintV1') == null,
  );
  const dismissLongPressHint = useCallback(() => {
    setShowLongPressHint(false);
    kv.set('today.seenLongPressHintV1', '1');
  }, []);
  // Retire after one session: persist the flag the first time the hint shows, so
  // a tap-only user who never long-presses still won't see it again next launch.
  // It stays visible for the rest of THIS session (state is untouched) until an
  // interaction dismisses it.
  useEffect(() => {
    if (showLongPressHint) kv.set('today.seenLongPressHintV1', '1');
  }, [showLongPressHint]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Cross-platform row menus (ActionSheetIOS is iOS-only → crashes Android).
  const [rowActions, setRowActions] = useState<{ id: string; label: string; done: boolean } | null>(
    null,
  );
  const [dayPickerId, setDayPickerId] = useState<string | null>(null);
  const [showCoachMark, setShowCoachMark] = useState(
    () => kv.getString('today.seenCoachMarkV1') == null,
  );

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    kv.set('today.seenCoachMarkV1', '1');
  }, []);

  // "Plan my day" — Pro feature. Free users → paywall. Pro users: stamp
  // planComputedAt, run the calendar-export wire (guarded), then open the plan
  // sheet. Today itself never flips a view — the plan is a thing the user summoned.
  const handlePlanMyDay = useCallback(() => {
    haptics.light();
    if (!isPro) {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
      return;
    }
    void markPlanned();

    // Export wire (C1 / B2): when calendar export is on, push the computed timed
    // plan to the Whenbee calendar. The store action is fully guarded (isExpoGo +
    // Pro + exportEnabled + whenbeeCalendarId), so this is safe to call
    // unconditionally — a no-op when any guard fails.
    if (dayPlan !== null) {
      const { exportEnabled } = useSettingsStore.getState().calendar;
      if (exportEnabled) {
        const currentDayTasks = useDayTasksStore.getState().dayTasks;
        const calEventIdByTaskId = new Map(
          currentDayTasks.map((task) => [task.id, task.calendarEventId ?? null]),
        );
        const timedTasks = dayPlan.timeline
          .filter((item) => item.kind === 'task')
          .map((item) => ({
            id: item.id,
            label: item.label,
            startMs: item.startAt,
            endMs: item.endAt,
            calendarEventId: calEventIdByTaskId.get(item.id) ?? null,
          }));
        void useDayTasksStore.getState().syncExportForSelectedDay(timedTasks);
      }
    }

    router.push('/(modals)/plan');
  }, [isPro, markPlanned, dayPlan]);

  // The done-list coach-mark auto-dismiss now lives in DoneSection (it only runs
  // once the list is expanded, so a collapsed list never burns the one-shot).
  function deleteTask(id: string) {
    haptics.medium();
    dismissCoachMark();
    void removeTask(id).then(() => useDayTasksStore.getState().loadShelf());
    setDeletingId(null);
  }
  // Next 7 days (tomorrow through +7) as pick-a-day menu items.
  function dayPickerItems(id: string): ActionSheetItem[] {
    const today = toLocalDayKey(Date.now());
    const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i + 1);
      const label = i === 0 ? 'Tomorrow' : WEEKDAY_LABELS[weekdayOf(key)] ?? key;
      return { label, onPress: () => void useDayTasksStore.getState().moveTask(id, key) };
    });
  }

  function showDayPicker(id: string) {
    setDayPickerId(id);
  }

  function promptRowActions(id: string, label: string, done = false) {
    setRowActions({ id, label, done });
  }

  function navigateToTimer(row: TodayRow) {
    router.push({
      pathname: '/(modals)/timer',
      params: {
        taskId: row.id,
        label: row.label,
        category: row.category,
        estimateMin: row.honestMin,
        guessMin: row.guessMin,
      },
    });
  }

  function editRow(id: string) {
    haptics.light();
    router.push({ pathname: '/(modals)/add-task', params: { editId: id } });
  }

  function startRow(row: TodayRow) {
    navigateToTimer(row);
  }

  // Build the honey strip from the tracked categories + their cached stats. One
  // hex per tracked category; sharpness/tier come straight from the calibration
  // cache (monotonic — cells only ever rise).
  const categories = useCategoriesStore((s) => s.categories);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);
  const honeyCells: HoneycombCell[] = categories.map((c) => {
    const stat = statsByCategory[c.id];
    return {
      categoryId: c.id,
      label: c.name,
      sharpness: stat?.sharpness ?? 0,
      tier: stat?.tier ?? 'Raw',
    };
  });

  const ritualDone = useFocusedValue(done.length > 0);
  const shownCells = useFocusedValue(honeyCells);

  const greeting = useGreeting();
  // Single call — avoids computing leadHoney(shownCells) twice in JSX.
  const lead = leadHoney(shownCells);

  // Day capacity — single call here so CapacityChip and CalendarOverlaySection
  // share the same resolved events (avoids double calendar fetches).
  const cap = useDayCapacity();
  // Keeps the "Does Today Fit?" Home-screen widget (Pro) live off the same
  // resolved capacity read above — never recomputes it. See
  // useCapacityWidgetPublisher for the Pro-gate-at-source rule.
  useCapacityWidgetPublisher(cap);
  // Keeps the "Your Bias" Home-screen widget (Pro) live — self-subscribes to
  // calibration stats + entitlement, so it's mounted with no args (see
  // useBiasWidgetPublisher for the Pro-gate-at-source rule).
  useBiasWidgetPublisher();

  const sectionLabel: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[1],
  };

  // Plan entry: a plan exists for the selected day when it was computed AND the
  // engine currently resolves a ready plan. PlanButton mirrors this glanceable state.
  const hasPlan = dayMeta?.planComputedAt != null && planStatus === 'ready';
  const startByClock = hasPlan && dayPlan ? formatClock(dayPlan.startBy, false) : null;

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            gap: t.space[5],
            paddingBottom: t.space[8],
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={cap.refreshing}
              onRefresh={() => void cap.refresh()}
              tintColor={t.colors.primary}
              colors={[t.colors.primary]}
            />
          }
        >
          <ScreenHeader
            title={headerTitle}
            subtitle={headerSubtitle}
            eyebrow={
              <AppText variant="caption" style={{ color: t.colors.inkSoft }}>
                {greeting.lead}
                {greeting.name ? (
                  <>
                    {', '}
                    <AppText
                      variant="caption"
                      style={{ color: t.colors.ink, fontWeight: t.fontWeight.bold }}
                    >
                      {greeting.name}
                    </AppText>
                  </>
                ) : null}
              </AppText>
            }
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[4] }}>
                <Pressable
                  onPress={() => router.push('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                  hitSlop={8}
                >
                  <Ionicons name="settings-outline" size={22} color={t.colors.inkSoft} />
                </Pressable>
                <TodayHeaderRing
                  sharpness={lead.sharpness}
                  tier={lead.tier}
                  stage={companionStage}
                  seed={companionSeed}
                />
              </View>
            }
          />

          {/* 7-day calendar strip — sits directly under the header title block,
              scrolls with content, lets the user jump to any day in the ±52 wk range. */}
          <CalendarStrip />

          {/* Capacity chip — only on today/future (past shows DayRecapCard instead)
              and only once the day has tasks; an empty day has no load to weigh.
              Passes the pre-resolved cap result so the chip skips its own fetch. */}
          {!isPastDay && totalCount > 0 ? (
            <CapacityChip cap={cap} />
          ) : null}

          {/* Daily ritual (opt-in) lived in the honey HUD footer; the HUD is gone,
              so render the seal standalone where the card was. */}
          {dailyRitualEnabled ? (
            <RitualSeal done={ritualDone} onLog={() => router.push('/(modals)/retro')} />
          ) : null}

          {/* Contextual focus-window nudge — shown when the engine has a personal
              window and the current time is before the window end (no task-count
              gate — removed Phase 5 A1; the insight is useful on an empty list too).
              Slots between the honey HUD and the quick-task chips row. */}
          <TodayFocusHook nowMs={Date.now()} />

          {/* Quick-task chips — repeating tasks the user has run before. Opt-out
              via settings (quickStartEnabled); also self-hides when no history
              exists (chips.length > 0 inside the component). */}
          {quickStartEnabled ? <QuickTaskChips /> : null}

          {/* Past-day banked recap — replaces the focus/empty hero entirely.
              The strip + header stay; the task list and running card are hidden.
              recap is guaranteed non-null when isPastDay (useDayRecap contract). */}
          {isPastDay && recap ? (
            <DayRecapCard recap={recap} rows={[...upNext, ...done]} />
          ) : (
            <>
              {/* A live session takes the focus slot itself (the same footprint as the
                  Next card, so nothing jumps), carrying its guess→plan context + the
                  live elapsed. Otherwise the Next card invites the next start. */}
              {isTimerRunning ? (
                <RunningFocusCard categoryName={categoryName} />
              ) : isToday && focus && summary ? (
                <Pressable
                  key={focus.id}
                  onLongPress={() => promptRowActions(focus.id, focus.label)}
                  delayLongPress={300}
                  accessibilityRole="button"
                  accessibilityLabel={`${focus.label}. Long-press to delete.`}
                >
                  <FocusCard
                    categoryLabel={categoryName(focus.category)}
                    taskTitle={focus.label}
                    summary={summary}
                    finishClock={formatClockMeridiem(
                      projectedFinish(Date.now(), summary.honestMinutes),
                    )}
                    onDelete={() => deleteTask(focus.id)}
                    isExiting={deletingId === focus.id}
                    onStart={() =>
                      router.push({
                        pathname: '/(modals)/timer',
                        params: {
                          taskId: focus.id,
                          label: focus.label,
                          category: focus.category,
                          estimateMin: summary.honestMinutes,
                          guessMin: focus.guessMin,
                        },
                      })
                    }
                  />
                </Pressable>
              ) : totalCount === 0 ? (
                <TodayEmptyState
                  variant={
                    selectedDate !== today
                      ? 'future'
                      : hasEverLogged
                        ? 'daily'
                        : 'first-run'
                  }
                  weekday={selectedDate !== today ? weekdayName(selectedDate) : undefined}
                  onPrimary={() => {
                    haptics.light();
                    router.push('/(modals)/add-task');
                  }}
                  onLog={() => router.push('/(modals)/retro')}
                />
              ) : null}
            </>
          )}

          {/* Plan entry + day body — only on today/future days. Past days use
              DayRecapCard above and never show the planner. */}
          {!isPastDay ? (
            <>
              {/* List body — the task list + calendar overlay (the only lens now). */}
              <Animated.View entering={FadeIn.duration(t.motion.base)}>
                {/* Scheduled routine blocks — Pro, derived read (no DB rows). */}
                {isPro && scheduledRoutineBlocks.length > 0 ? (
                  <View style={{ gap: t.space[2], marginBottom: t.space[2] }}>
                    <Text style={sectionLabel}>{"TODAY'S ROUTINES"}</Text>
                    {scheduledRoutineBlocks.map((block) => (
                      <ScheduledRoutineBlock key={block.routineId} block={block} />
                    ))}
                  </View>
                ) : null}

                {upNext.length > 0 ? (
                  <View style={{ gap: t.space[2] }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={sectionLabel}>TASKS</Text>
                      {totalCount > 0 ? (
                        <PlanButton
                          hasPlan={hasPlan}
                          startByClock={startByClock}
                          onPress={
                            hasPlan
                              ? () => {
                                  haptics.light();
                                  router.push('/(modals)/plan');
                                }
                              : handlePlanMyDay
                          }
                        />
                      ) : null}
                    </View>
                    {upNext.map((row, idx) => (
                      <TaskRow
                        key={row.id}
                        title={row.label}
                        categoryLabel={row.categoryLabel}
                        guessMin={row.guessMin}
                        honestMin={row.honestMin}
                        carriedFrom={row.carriedFrom}
                        onPress={() => startRow(row)}
                        onDelete={() => deleteTask(row.id)}
                        onLongPress={() => { dismissLongPressHint(); promptRowActions(row.id, row.label); }}
                        onMove={() => void useDayTasksStore.getState().moveToTomorrow(row.id)}
                        showCoachMark={showLongPressHint && idx === 0}
                        coachLabel="Press & hold for options"
                        onCoachMarkDismiss={dismissLongPressHint}
                        isExiting={deletingId === row.id}
                      />
                    ))}
                  </View>
                ) : null}

                {/* Read-only calendar overlay — Pro + showEvents only (cap returns []
                    for free users so this naturally renders nothing for them).
                    Sits above Done so finished work reads last. */}
                <CalendarOverlaySection
                  events={cap.events}
                  allDayEvents={cap.allDayEvents}
                  lastFetchedAtMs={cap.lastFetchedAtMs}
                  onRefresh={() => void cap.refresh()}
                  refreshing={cap.refreshing}
                />

                {done.length > 0 ? (
                  <DoneSection
                    rows={done}
                    deletingId={deletingId}
                    onDelete={deleteTask}
                    onLongPress={(id, label) => promptRowActions(id, label, true)}
                    showCoachMark={showCoachMark}
                    onCoachMarkDismiss={dismissCoachMark}
                  />
                ) : null}
              </Animated.View>
            </>
          ) : null}

          {/* No-day-yet shelf — quiet, beneath all day tasks, only when populated. */}
          <ShelfSection
            shelfTasks={shelfTasks}
            onMoveTask={(id, target) => {
              if (target === 'tomorrow') {
                haptics.light();
                void useDayTasksStore.getState().moveToTomorrow(id).then(() =>
                  useDayTasksStore.getState().loadShelf()
                );
              }
            }}
            onDeleteTask={(id) => {
              haptics.medium();
              void useDayTasksStore.getState().removeTask(id).then(() =>
                useDayTasksStore.getState().loadShelf()
              );
            }}
          />

          {totalCount === 0 && !isTimerRunning ? null : (
            <RetroLogChip
              label="Finished something else? Log it too"
              onPress={() => router.push('/(modals)/retro')}
            />
          )}
        </ScrollView>
      </View>

      <ActionSheet
        visible={rowActions !== null}
        title={rowActions?.label}
        onCancel={() => setRowActions(null)}
        items={
          rowActions
            ? [
                ...(canEditRow(isTimerRunning, runningTaskId, rowActions.id, rowActions.done)
                  ? [{ label: 'Edit', onPress: () => editRow(rowActions.id) }]
                  : []),
                { label: 'Move to tomorrow', onPress: () => void useDayTasksStore.getState().moveToTomorrow(rowActions.id) },
                { label: 'Pick a day…', onPress: () => showDayPicker(rowActions.id) },
                { label: 'Remove', destructive: true, onPress: () => setDeletingId(rowActions.id) },
              ]
            : []
        }
      />

      <ActionSheet
        visible={dayPickerId !== null}
        title="Pick a day"
        onCancel={() => setDayPickerId(null)}
        items={dayPickerId ? dayPickerItems(dayPickerId) : []}
      />
    </Screen>
  );
}
