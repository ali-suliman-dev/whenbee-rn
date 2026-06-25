import { View, Text, Pressable, ScrollView, ActionSheetIOS, type TextStyle } from 'react-native';
import { useState, useCallback, useEffect, useRef } from 'react';
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
import { SwitchTaskSheet } from '@/src/features/today/SwitchTaskSheet';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { projectedFinish, formatClockMeridiem } from '@/src/lib/time';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { toLocalDayKey, addDays, weekdayOf, compareDayKeys } from '@/src/lib/day';
import { kv } from '@/src/lib/kv';
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
import { useGreeting } from '@/src/features/today/useGreeting';
import { TodayFocusHook } from '@/src/features/today/TodayFocusHook';
import { CalendarStrip } from '@/src/features/today/calendarStrip/CalendarStrip';
import { ShelfSection } from '@/src/features/today/ShelfSection';
import { DayRecapCard } from '@/src/features/today/DayRecapCard';
import { useDayRecap } from '@/src/features/today/useDayRecap';
import { CapacityChip } from '@/src/features/today/CapacityChip';
import { CalendarOverlaySection } from '@/src/features/today/CalendarOverlaySection';
import { useDayCapacity } from '@/src/features/today/useDayCapacity';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

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

  const trackStyle = {
    flexDirection: 'row' as const,
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.full,
    padding: 3,
    alignSelf: 'flex-start' as const,
  };

  function pillStyle(active: boolean) {
    return {
      paddingHorizontal: t.space[4],
      paddingVertical: t.space[2],
      borderRadius: t.radii.full,
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
        accessibilityLabel="List view"
        accessibilityState={{ selected: viewMode === 'list' }}
        hitSlop={4}
      >
        <View style={pillStyle(viewMode === 'list')}>
          <Text style={labelStyle(viewMode === 'list')}>List</Text>
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
        accessibilityLabel={isPro ? 'Timeline view' : 'Timeline view — Pro feature'}
        accessibilityState={{ selected: viewMode === 'timeline' }}
        hitSlop={4}
      >
        <View style={pillStyle(viewMode === 'timeline')}>
          <Text style={labelStyle(viewMode === 'timeline')}>Timeline</Text>
        </View>
      </Pressable>
    </View>
  );
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
  const viewMode = useDayTasksStore((s) => s.viewMode);
  const setViewMode = useDayTasksStore((s) => s.setViewMode);
  const markPlanned = useDayTasksStore((s) => s.markPlanned);
  const isPro = useEntitlement((s) => s.isPro);
  const today = toLocalDayKey(Date.now());
  const isPastDay = compareDayKeys(selectedDate, today) < 0;
  const headerTitle = selectedDate === today ? 'Today' : weekdayName(selectedDate);
  const headerSubtitle = dateLabel(selectedDate);

  // Reset to List whenever the selected day changes — prevents being stranded
  // in a stale Timeline from a previous day's plan.
  const prevSelectedDate = useRef(selectedDate);
  useEffect(() => {
    if (prevSelectedDate.current !== selectedDate) {
      prevSelectedDate.current = selectedDate;
      setViewMode('list');
    }
  }, [selectedDate, setViewMode]);

  // Recap for past days — null when today or future.
  const recap = useDayRecap();

  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskLabel = useTimerStore((s) => s.taskLabel);
  const [pendingRow, setPendingRow] = useState<TodayRow | null>(null);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
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
  const [showCoachMark, setShowCoachMark] = useState(
    () => kv.getString('today.seenCoachMarkV1') == null,
  );

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    kv.set('today.seenCoachMarkV1', '1');
  }, []);

  // "Plan my day" — Pro feature. Free users are routed to the paywall.
  // Pro users: stamps planComputedAt (fire-and-forget) then cross-fades to Timeline.
  const handlePlanMyDay = useCallback(() => {
    haptics.light();
    if (!isPro) {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'plan_my_day' } });
      return;
    }
    void markPlanned();
    setViewMode('timeline');
  }, [isPro, markPlanned, setViewMode]);

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
  function showDayPicker(id: string) {
    // Build next 7 days as labels for pick-a-day (tomorrow through +7).
    const today = toLocalDayKey(Date.now());
    const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
    const days = Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i + 1);
      const label = i === 0 ? 'Tomorrow' : WEEKDAY_LABELS[weekdayOf(key)] ?? key;
      return { key, label };
    });
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Pick a day',
        options: [...days.map((d) => d.label), 'Cancel'],
        cancelButtonIndex: days.length,
      },
      (i) => {
        if (i < days.length) {
          const day = days[i];
          if (day) void useDayTasksStore.getState().moveTask(id, day.key);
        }
      },
    );
  }

  function promptRowActions(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: ['Move to tomorrow', 'Pick a day…', 'Remove', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i === 0) void useDayTasksStore.getState().moveToTomorrow(id);
        else if (i === 1) showDayPicker(id);
        else if (i === 2) setDeletingId(id);
      },
    );
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
            largeTitle
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

          {/* Capacity chip — only on today/future (past shows DayRecapCard instead).
              Passes the pre-resolved cap result so the chip skips its own fetch. */}
          {!isPastDay ? (
            <CapacityChip weekdayLabel={headerTitle} cap={cap} />
          ) : null}

          {/* Daily ritual (opt-in) lived in the honey HUD footer; the HUD is gone,
              so render the seal standalone where the card was. */}
          {dailyRitualEnabled ? (
            <RitualSeal done={ritualDone} onLog={() => router.push('/(modals)/retro')} />
          ) : null}

          {/* Contextual focus-window nudge — only when the engine has a personal
              window, the window hasn't ended, and at least one queued task exists.
              Slots between the honey HUD and the quick-task chips row. */}
          <TodayFocusHook nowMs={Date.now()} />

          {/* Quick-task chips — repeating tasks the user has run before. Only
              shown when history exists (chips.length > 0 inside the component);
              slots between the honey HUD and whatever occupies the focus slot. */}
          <QuickTaskChips />

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
              ) : focus && summary ? (
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

          {/* List ⇄ Timeline toggle + day body — only on today/future days.
              Past days use DayRecapCard above and never show the planner lens. */}
          {!isPastDay ? (
            <>
              {/* Segmented control: List ⇄ Timeline */}
              <ViewToggle
                viewMode={viewMode}
                onSelect={handleViewSelect}
                onTimelineGated={handleTimelineGated}
                isPro={isPro}
              />

              {viewMode === 'timeline' && isPro ? (
                /* Timeline lens — Pro only; DayTimeline is self-contained (reads useDayPlan). */
                <Animated.View entering={FadeIn.duration(t.motion.base)}>
                  <DayTimeline />
                </Animated.View>
              ) : (
                /* List lens — the existing task list + calendar overlay. */
                <Animated.View entering={FadeIn.duration(t.motion.base)}>
                  {/* "Plan my day" — quiet action chip beneath the toggle in List mode.
                      Stamps planComputedAt and cross-fades to the Timeline.
                      Pro gating is wired in C1; here this is the happy-path only. */}
                  <Pressable
                    testID="plan-my-day-btn"
                    onPress={handlePlanMyDay}
                    accessibilityRole="button"
                    accessibilityLabel={isPro ? 'Plan my day' : 'Plan my day — Pro feature'}
                    hitSlop={8}
                    style={{ alignSelf: 'flex-start', marginBottom: t.space[3] }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.space[2],
                        paddingHorizontal: t.space[4],
                        paddingVertical: t.space[2],
                        backgroundColor: t.colors.primaryWash,
                        borderRadius: t.radii.full,
                      }}
                    >
                      <Ionicons name="sparkles-outline" size={t.iconSize.xs} color={t.colors.primary} />
                      <Text
                        style={{
                          fontSize: t.fontSize.sm,
                          fontWeight: t.fontWeight.medium,
                          color: t.colors.primary,
                          fontFamily: t.fontFamily.ui,
                        }}
                      >
                        Plan my day
                      </Text>
                    </View>
                  </Pressable>

                  {upNext.length > 0 ? (
                    <View style={{ gap: t.space[2] }}>
                      <Text style={sectionLabel}>UP NEXT</Text>
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
              label="Finished? Log it. Ripens your honey."
              onPress={() => router.push('/(modals)/retro')}
            />
          )}
        </ScrollView>
      </View>

      <SwitchTaskSheet
        visible={pendingRow !== null}
        leavingLabel={runningTaskLabel ?? 'current task'}
        startingLabel={pendingRow?.label ?? ''}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </Screen>
  );
}
