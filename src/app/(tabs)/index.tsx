import { View, Text, Pressable, ScrollView, ActionSheetIOS, type TextStyle } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { haptics } from '@/src/lib/haptics';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useToday, type TodayRow } from '@/src/features/today/useToday';
import { FocusCard } from '@/src/features/today/FocusCard';
import { RunningFocusCard } from '@/src/features/today/RunningFocusCard';
import { TaskRow } from '@/src/features/today/TaskRow';
import { TodayHud } from '@/src/components/honeycomb/TodayHud';
import type { HoneycombCell } from '@/src/components/honeycomb/Honeycomb';
import { TodayEmptyState } from '@/src/features/today/TodayEmptyState';
import { RetroLogChip } from '@/src/features/today/RetroLogChip';
import { SwitchTaskSheet } from '@/src/features/today/SwitchTaskSheet';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { projectedFinish, formatClockMeridiem } from '@/src/lib/time';
import { useTasksStore } from '@/src/stores/tasksStore';
import { kv } from '@/src/lib/kv';

// Date label, e.g. "Fri · Jun 12" — the day + date, no clock (the time added
// nothing here and ticked distractingly).
function dateLabel(now: Date): string {
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${day} · ${date}`;
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
    todayReclaimMin,
    companionStage,
    companionSeed,
    reclaimLifetimeMin,
    hasEverLogged,
  } = useToday();
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskLabel = useTimerStore((s) => s.taskLabel);
  const [pendingRow, setPendingRow] = useState<TodayRow | null>(null);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const removeTask = useTasksStore((s) => s.removeTask);
  const promoteToFocus = useTasksStore((s) => s.promoteToFocus);

  // First-run peek: teach the hidden swipe once, then never again.
  const [peekFirstRow] = useState(() => kv.getString('today.seenSwipeHint') == null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCoachMark, setShowCoachMark] = useState(
    () => kv.getString('today.seenCoachMarkV1') == null,
  );

  const dismissCoachMark = useCallback(() => {
    setShowCoachMark(false);
    kv.set('today.seenCoachMarkV1', '1');
  }, []);

  useEffect(() => {
    if (peekFirstRow) kv.set('today.seenSwipeHint', '1');
  }, [peekFirstRow]);

  const hasDone = done.length > 0;
  useEffect(() => {
    if (!showCoachMark || !hasDone) return;
    const timer = setTimeout(dismissCoachMark, 4000);
    return () => clearTimeout(timer);
  // dismissCoachMark is stable (useCallback with no deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoachMark, hasDone]);

  function deleteTask(id: string) {
    haptics.medium();
    dismissCoachMark();
    removeTask(id);
    setDeletingId(null);
  }
  function promptDelete(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: ['Remove', 'Cancel'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) setDeletingId(id);
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
    promoteToFocus(row.id);
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
            title="Today"
            subtitle={dateLabel(new Date())}
            right={
              <Pressable
                onPress={() => router.push('/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={8}
              >
                <Ionicons name="settings-outline" size={22} color={t.colors.inkSoft} />
              </Pressable>
            }
          />

          {/* The honey HUD hugs the header (tighten the inherited list gap) but
              sits clearly apart from the focus card below it. */}
          <View style={{ marginTop: -t.space[2], marginBottom: t.space[3] }}>
            <TodayHud
              cells={honeyCells}
              stage={companionStage}
              seed={companionSeed}
              onPress={() => router.push('/(tabs)/whenbee')}
              reclaimMin={todayReclaimMin}
              ritualEnabled={dailyRitualEnabled}
              ritualDone={done.length > 0}
              onLogRitual={() => router.push('/(modals)/retro')}
            />
          </View>

          {/* A live session takes the focus slot itself (the same footprint as the
              Next card, so nothing jumps), carrying its guess→plan context + the
              live elapsed. Otherwise the Next card invites the next start. */}
          {isTimerRunning ? (
            <RunningFocusCard categoryName={categoryName} />
          ) : focus && summary ? (
            <Pressable
              onLongPress={() => promptDelete(focus.id, focus.label)}
              delayLongPress={300}
              accessibilityRole="button"
              accessibilityLabel={`${focus.label}. Long-press to delete.`}
            >
              <FocusCard
                category={focus.category}
                categoryLabel={categoryName(focus.category)}
                taskTitle={focus.label}
                summary={summary}
                finishClock={formatClockMeridiem(projectedFinish(Date.now(), summary.honestMinutes))}
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
              variant={hasEverLogged ? 'daily' : 'first-run'}
              reclaimLifetimeMin={reclaimLifetimeMin}
              onPrimary={() => {
                haptics.light();
                router.push('/(modals)/add-task');
              }}
              onLog={() => router.push('/(modals)/retro')}
            />
          ) : null}

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
                  onPress={() => startRow(row)}
                  onDelete={() => deleteTask(row.id)}
                  onLongPress={() => promptDelete(row.id, row.label)}
                  peekHint={peekFirstRow && idx === 0}
                  isExiting={deletingId === row.id}
                />
              ))}
            </View>
          ) : null}

          {done.length > 0 ? (
            <View style={{ gap: t.space[2] }}>
              <Text style={sectionLabel}>DONE TODAY</Text>
              {done.map((row, idx) => (
                <TaskRow
                  key={row.id}
                  title={row.label}
                  categoryLabel={row.categoryLabel}
                  guessMin={row.guessMin}
                  honestMin={row.honestMin}
                  actualMin={row.actualMin}
                  done
                  onDelete={() => deleteTask(row.id)}
                  onLongPress={() => promptDelete(row.id, row.label)}
                  isExiting={deletingId === row.id}
                  showCoachMark={showCoachMark && idx === 0}
                  onCoachMarkDismiss={dismissCoachMark}
                />
              ))}
            </View>
          ) : null}

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
