import { View, Text, Pressable, ScrollView, ActionSheetIOS, type TextStyle } from 'react-native';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
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
import { kv } from '@/src/lib/kv';
import { useFocusedValue } from '@/src/hooks/useFocusedValue';
import { useGreeting } from '@/src/features/today/useGreeting';
import { TodayFocusHook } from '@/src/features/today/TodayFocusHook';

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
    companionStage,
    companionSeed,
    hasEverLogged,
  } = useToday();
  const isTimerRunning = useTimerStore((s) => s.isRunning);
  const runningTaskLabel = useTimerStore((s) => s.taskLabel);
  const [pendingRow, setPendingRow] = useState<TodayRow | null>(null);
  const dailyRitualEnabled = useSettingsStore((s) => s.dailyRitualEnabled);
  const removeTask = useDayTasksStore((s) => s.removeTask);
  const promoteToFocus = useDayTasksStore((s) => s.promoteToFocus);

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

  // The done-list coach-mark auto-dismiss now lives in DoneSection (it only runs
  // once the list is expanded, so a collapsed list never burns the one-shot).
  function deleteTask(id: string) {
    haptics.medium();
    dismissCoachMark();
    void removeTask(id);
    setDeletingId(null);
  }
  function promptDelete(id: string, label: string) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: ['Remove', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
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
            largeTitle
            subtitle={dateLabel(new Date())}
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

          {/* A live session takes the focus slot itself (the same footprint as the
              Next card, so nothing jumps), carrying its guess→plan context + the
              live elapsed. Otherwise the Next card invites the next start. */}
          {isTimerRunning ? (
            <RunningFocusCard categoryName={categoryName} />
          ) : focus && summary ? (
            <Pressable
              key={focus.id}
              onLongPress={() => promptDelete(focus.id, focus.label)}
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
              variant={hasEverLogged ? 'daily' : 'first-run'}
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
              onLongPress={promptDelete}
              showCoachMark={showCoachMark}
              onCoachMarkDismiss={dismissCoachMark}
            />
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
