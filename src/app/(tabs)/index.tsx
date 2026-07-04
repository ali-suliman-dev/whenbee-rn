import { View, Text, Pressable, ScrollView, type TextStyle } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
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
import { SwitchTaskSheet } from '@/src/features/today/SwitchTaskSheet';
import { ActionSheet, type ActionSheetItem } from '@/src/components/ActionSheet';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { projectedFinish, formatClockMeridiem } from '@/src/lib/time';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { toLocalDayKey, addDays, compareDayKeys } from '@/src/lib/day';
import { kv } from '@/src/lib/kv';
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
import { useGreeting } from '@/src/features/today/useGreeting';
import { TodayFocusHook } from '@/src/features/today/TodayFocusHook';
import { CalendarStrip } from '@/src/features/today/calendarStrip/CalendarStrip';
import { PlanMyDayButton } from '@/src/features/today/PlanMyDayButton';
import { ShelfSection } from '@/src/features/today/ShelfSection';
import { DayRecapCard } from '@/src/features/today/DayRecapCard';
import { useDayRecap } from '@/src/features/today/useDayRecap';
import { CapacityChip } from '@/src/features/today/CapacityChip';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useScheduledRoutines } from '@/src/features/today/useScheduledRoutines';
import { ScheduledRoutineBlock } from '@/src/features/today/ScheduledRoutineBlock';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useLocalizedFormat } from '@/src/i18n/useLocalizedFormat';

// Date label for a day-key, e.g. "Fri · Jun 12" — the day + date, no clock.
// `fmt` comes from `useLocalizedFormat()` in the caller — locale-aware, hoisted.
function dateLabel(key: string, fmt: ReturnType<typeof useLocalizedFormat>): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return `${fmt.weekdayShort(date)} · ${fmt.monthDay(date)}`;
}

/** Full weekday name for the header title when a non-today day is selected. */
function weekdayName(key: string, fmt: ReturnType<typeof useLocalizedFormat>): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return fmt.weekdayLong(new Date(y, m - 1, d));
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewToggle — segmented List ⇄ Timeline control
// ─────────────────────────────────────────────────────────────────────────────

interface ViewToggleProps {
  viewMode: 'list' | 'timeline';
  onSelect: (m: 'list' | 'timeline') => void;
  /** Called instead of onSelect('timeline') when the user is on the free tier. */
  onTimelineGated?: () => void;
  isPro: boolean;
}

function ViewToggle({ viewMode, onSelect, onTimelineGated, isPro }: ViewToggleProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('today');

  const trackStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: t.size.control.sm,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    // Android squares rounded corners on press-layer promotion — pin the clip.
    overflow: 'hidden' as const,
    padding: 3,
    alignSelf: 'flex-start' as const,
  };

  function pillStyle(active: boolean) {
    return {
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[2],
      borderRadius: t.radii.full,
      overflow: 'hidden' as const,
      backgroundColor: active ? t.colors.surface : 'transparent',
    };
  }

  function labelStyle(active: boolean): TextStyle {
    return {
      fontSize: t.fontSize.sm,
      fontWeight: active ? t.fontWeight.semibold : t.fontWeight.regular,
      color: active ? t.colors.ink : t.colors.inkSoft,
      fontFamily: t.fontFamily.ui,
    };
  }

  return (
    <View style={trackStyle} accessibilityRole="tablist">
      <Pressable
        testID="view-toggle-list"
        onPress={() => onSelect('list')}
        accessibilityRole="tab"
        accessibilityLabel={tr('viewToggle.listA11y')}
        accessibilityState={{ selected: viewMode === 'list' }}
        hitSlop={4}
      >
        <View style={pillStyle(viewMode === 'list')}>
          <Text style={labelStyle(viewMode === 'list')}>{tr('viewToggle.list')}</Text>
        </View>
      </Pressable>
      <Pressable
        testID="view-toggle-timeline"
        onPress={() => {
          if (!isPro) {
            onTimelineGated?.();
          } else {
            onSelect('timeline');
          }
        }}
        accessibilityRole="tab"
        accessibilityLabel={isPro ? tr('viewToggle.timelineA11y') : tr('viewToggle.timelineProA11y')}
        accessibilityState={{ selected: viewMode === 'timeline' }}
        hitSlop={4}
      >
        <View style={pillStyle(viewMode === 'timeline')}>
          <Text style={labelStyle(viewMode === 'timeline')}>{tr('viewToggle.timeline')}</Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function Today() {
  const t = useTheme();
  const { t: tr } = useTranslation('today');
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
  const viewMode = useDayTasksStore((s) => s.viewMode);
  const setViewMode = useDayTasksStore((s) => s.setViewMode);
  const markPlanned = useDayTasksStore((s) => s.markPlanned);
  const isPro = useEntitlement((s) => s.isPro);
  const today = toLocalDayKey(Date.now());
  const isPastDay = compareDayKeys(selectedDate, today) < 0;
  const isToday = selectedDate === today;

  // Scheduled routine blocks for the selected day — derived read, no DB writes.
  // Only shown on today/future days (past days use DayRecapCard).
  const { blocks: scheduledRoutineBlocks } = useScheduledRoutines(selectedDate);
  const fmt = useLocalizedFormat();
  const headerTitle = selectedDate === today ? tr('header.todayTitle') : weekdayName(selectedDate, fmt);
  const headerSubtitle = dateLabel(selectedDate, fmt);

  // Reset to List whenever the selected day changes — prevents being stranded
  // in a stale Timeline from a previous day's plan.
  const prevSelectedDate = useRef(selectedDate);
  useEffect(() => {
    if (prevSelectedDate.current !== selectedDate) {
      prevSelectedDate.current = selectedDate;
      setViewMode('list');
    }
  }, [selectedDate, setViewMode]);

  // Day plan — consumed here only for the export wire; DayTimeline re-reads it
  // internally. We call the hook once so the plan is available in handlePlanMyDay.
  const { plan: dayPlan } = useDayPlan();

  // Recap for past days — null when today or future.
  const recap = useDayRecap();

  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskLabel = useTimerStore((s) => s.taskLabel);
  const [pendingRow, setPendingRow] = useState<TodayRow | null>(null);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const quickStartEnabled = useSettingsStore((s) => s.quickStartEnabled);
  const removeTask = useDayTasksStore((s) => s.removeTask);
  const promoteToFocus = useDayTasksStore((s) => s.promoteToFocus);
  const shelfTasks = useDayTasksStore((s) => s.shelfTasks);

  // Keep the shelf fresh: load on mount and whenever tasks change.
  useEffect(() => {
    void useDayTasksStore.getState().loadShelf();
  }, [totalCount]);

  // First-run peek: teach the hidden swipe once, then never again. The flag is
  // burned only after the peek actually animates (see onPeeked below) — never on
  // a bare mount — so the one-shot can't be spent without the user seeing it.
  const [peekFirstRow] = useState(() => kv.getString('today.seenSwipeHint') == null);
  const markSwipeHintSeen = useCallback(() => kv.set('today.seenSwipeHint', '1'), []);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Cross-platform row menus (ActionSheetIOS is iOS-only → crashes Android).
  const [rowActions, setRowActions] = useState<{ id: string; label: string } | null>(null);
  const [dayPickerId, setDayPickerId] = useState<string | null>(null);
  const [showCoachMark, setShowCoachMark] = useState(
    () => kv.getString('today.seenCoachMarkV1') == null,
  );

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    kv.set('today.seenCoachMarkV1', '1');
  }, []);

  // "Plan my day" — Pro feature. Free users are routed to the paywall.
  // Pro users: stamps planComputedAt, syncs the timed plan to the Whenbee calendar
  // (fire-and-forget, guarded inside the store action), then cross-fades to Timeline.
  const handlePlanMyDay = useCallback(() => {
    haptics.light();
    if (!isPro) {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
      return;
    }
    void markPlanned();
    setViewMode('timeline');

    // Export wire (C1 / B2): if the calendar export is on, push the computed
    // timed plan to the Whenbee calendar. The store action is fully guarded
    // (isExpoGo + Pro + exportEnabled + whenbeeCalendarId) so this is safe to
    // call unconditionally — it's a no-op when any guard fails.
    //
    // We build PlannedExportTask from the plan's 'task' timeline items.
    // calendarEventId comes from the store's dayTasks (the db source of truth).
    if (dayPlan !== null) {
      const { exportEnabled } = useSettingsStore.getState().calendar;
      if (exportEnabled) {
        const currentDayTasks = useDayTasksStore.getState().dayTasks;
        const calEventIdByTaskId = new Map(
          currentDayTasks.map((t) => [t.id, t.calendarEventId ?? null]),
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
  }, [isPro, markPlanned, setViewMode, dayPlan]);

  // Toggle between list and timeline views.
  // Free users tapping Timeline hit the paywall gate via onTimelineGated.
  const handleViewSelect = useCallback(
    (m: 'list' | 'timeline') => {
      haptics.light();
      setViewMode(m);
    },
    [setViewMode],
  );

  // Called from ViewToggle when a free user taps the Timeline pill.
  const handleTimelineGated = useCallback(() => {
    haptics.light();
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
  }, []);

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
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i + 1);
      const [y, m, d] = key.split('-').map(Number) as [number, number, number];
      const label = i === 0 ? tr('actions.tomorrow') : fmt.weekdayShort(new Date(y, m - 1, d));
      return { label, onPress: () => void useDayTasksStore.getState().moveTask(id, key) };
    });
  }

  function showDayPicker(id: string) {
    setDayPickerId(id);
  }

  function promptRowActions(id: string, label: string) {
    setRowActions({ id, label });
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

  function startRow(row: TodayRow) {
    if (isTimerRunning) {
      haptics.light();
      setPendingRow(row);
    } else {
      navigateToTimer(row);
    }
  }

  function confirmSwitch() {
    if (pendingRow === null) return;
    haptics.medium();
    const row = pendingRow;
    setPendingRow(null);
    void promoteToFocus(row.id);
    navigateToTimer(row);
  }

  function cancelSwitch() {
    haptics.light();
    setPendingRow(null);
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

  const sectionLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[1],
  };

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            gap: t.space[5],
            paddingBottom: t.space[8],
          }}
          showsVerticalScrollIndicator={false}
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
                  accessibilityLabel={tr('header.settingsA11y')}
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
            <CapacityChip weekdayLabel={headerTitle} cap={cap} />
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
                  accessibilityLabel={tr('focusCardWrap.longPressA11y', { label: focus.label })}
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
                  weekday={selectedDate !== today ? weekdayName(selectedDate, fmt) : undefined}
                  onPrimary={() => {
                    haptics.light();
                    router.push('/(modals)/add-task');
                  }}
                  onLog={() => router.push('/(modals)/retro')}
                />
              ) : null}
            </>
          )}

          {/* List ⇄ Timeline toggle + day body — only on today/future days.
              Past days use DayRecapCard above and never show the planner lens. */}
          {!isPastDay ? (
            <>
              {/* Control row: List ⇄ Timeline segmented control (left) + the
                  "Plan my day" action (right edge). Only once the day has tasks —
                  there's nothing to switch lenses on or plan when it's empty. The
                  action persists across both lenses — label swaps to "Re-plan" in
                  Timeline so the planner can be re-run in place after the list changes. */}
              {totalCount > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: t.space[3],
                  }}
                >
                  <ViewToggle
                    viewMode={viewMode}
                    onSelect={handleViewSelect}
                    onTimelineGated={handleTimelineGated}
                    isPro={isPro}
                  />
                  <PlanMyDayButton
                    onPress={handlePlanMyDay}
                    isPro={isPro}
                    label={viewMode === 'timeline' ? tr('planMyDay.replan') : tr('planMyDay.plan')}
                  />
                </View>
              ) : null}

              {viewMode === 'timeline' && isPro ? (
                /* Timeline lens — Pro only; DayTimeline is self-contained (reads useDayPlan). */
                <Animated.View entering={FadeIn.duration(t.motion.base)}>
                  <DayTimeline />
                </Animated.View>
              ) : (
                /* List lens — the existing task list + calendar overlay. */
                <Animated.View entering={FadeIn.duration(t.motion.base)}>
                  {/* Scheduled routine blocks — one per routine scheduled for
                      this weekday. Derived read: no task rows written to the DB.
                      Each block is collapsible and has a "Run" affordance. Only
                      shown for Pro users on today/future days (isPastDay is
                      already guarded by the outer !isPastDay condition). */}
                  {isPro && scheduledRoutineBlocks.length > 0 ? (
                    <View style={{ gap: t.space[2], marginBottom: t.space[2] }}>
                      <Text style={sectionLabel}>{tr('sections.todaysRoutines')}</Text>
                      {scheduledRoutineBlocks.map((block) => (
                        <ScheduledRoutineBlock key={block.routineId} block={block} />
                      ))}
                    </View>
                  ) : null}

                  {upNext.length > 0 ? (
                    <View style={{ gap: t.space[2] }}>
                      <Text style={sectionLabel}>{tr('sections.upNext')}</Text>
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
                          onLongPress={() => promptRowActions(row.id, row.label)}
                          onMove={() => void useDayTasksStore.getState().moveToTomorrow(row.id)}
                          peekHint={peekFirstRow && idx === 0}
                          onPeeked={markSwipeHintSeen}
                          isExiting={deletingId === row.id}
                        />
                      ))}
                    </View>
                  ) : null}

                  {done.length > 0 ? (
                    <DoneSection
                      rows={done}
                      deletingId={deletingId}
                      onDelete={deleteTask}
                      onLongPress={promptRowActions}
                      showCoachMark={showCoachMark}
                      onCoachMarkDismiss={dismissCoachMark}
                    />
                  ) : null}

                  {/* Read-only calendar overlay — Pro + showEvents only (cap returns []
                      for free users so this naturally renders nothing for them). */}
                  <CalendarOverlaySection
                    events={cap.events}
                    allDayEvents={cap.allDayEvents}
                  />
                </Animated.View>
              )}
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
              label={tr('retroChip.label')}
              onPress={() => router.push('/(modals)/retro')}
            />
          )}
        </ScrollView>
      </View>

      <SwitchTaskSheet
        visible={pendingRow !== null}
        leavingLabel={runningTaskLabel ?? tr('switchSheetFallback.currentTask')}
        startingLabel={pendingRow?.label ?? ''}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />

      <ActionSheet
        visible={rowActions !== null}
        title={rowActions?.label}
        onCancel={() => setRowActions(null)}
        items={
          rowActions
            ? [
                { label: tr('actions.moveToTomorrow'), onPress: () => void useDayTasksStore.getState().moveToTomorrow(rowActions.id) },
                { label: tr('actions.pickADay'), onPress: () => showDayPicker(rowActions.id) },
                { label: tr('actions.remove'), destructive: true, onPress: () => setDeletingId(rowActions.id) },
              ]
            : []
        }
      />

      <ActionSheet
        visible={dayPickerId !== null}
        title={tr('actions.pickDayTitle')}
        onCancel={() => setDayPickerId(null)}
        items={dayPickerId ? dayPickerItems(dayPickerId) : []}
      />
    </Screen>
  );
}
