import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, ActionSheetIOS, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { Toast } from '@/src/components/Toast';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useAddTask } from '@/src/features/add-task/useAddTask';
import { CategoryChips } from '@/src/features/shared/CategoryChips';
import { TimeField } from '@/src/features/shared/TimeField';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';
import { AntiChaseCoachCard } from '@/src/features/add-task/AntiChaseCoachCard';
import { GoalCoachCard } from '@/src/features/add-task/GoalCoachCard';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { toLocalDayKey, addDays, weekdayOf } from '@/src/lib/day';

// ──────────────────────────────────────────────────────────────────────────────
// Add Task (Screen 10, formSheet) — add an ad-hoc task and surface the honest
// suggestion LIVE (guess × learned multiplier) at the decision moment.
//   • Add & start timer → Timer with the honest estimate + original guess.
//   • Add to today → queue it, toast "Added to today", dismiss.
// Actions gate gently on title + category (no scold).
// ──────────────────────────────────────────────────────────────────────────────

// Short weekday labels for the date picker sheet.
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Human label for a day option in the picker. */
function dayLabel(key: string, offsetFromToday: number): string {
  if (offsetFromToday === 0) return 'Today';
  if (offsetFromToday === 1) return 'Tomorrow';
  return WEEKDAY_SHORT[weekdayOf(key)] ?? key;
}

/** Header label showing which day the task will be added to. */
function targetDayLabel(targetDate: string | null, today: string): string {
  if (targetDate === null) return 'No day yet';
  if (targetDate === today) return 'Today';
  const offset = Math.round(
    (new Date(targetDate).getTime() - new Date(today).getTime()) / 86400000,
  );
  if (offset === 1) return 'Tomorrow';
  return WEEKDAY_SHORT[weekdayOf(targetDate)] ?? targetDate;
}

export default function AddTask() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const toastDismissMs = t.motion.pulse; // let the toast land before the sheet closes
  // Arrived from the trio mic quick-action → title pre-filled from the transcript.
  const { title: spokenTitle } = useLocalSearchParams<{ title?: string }>();
  const a = useAddTask(spokenTitle);
  const [toastVisible, setToastVisible] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Target date for the new task. Null = shelf (no day yet).
  // Initialised to the store's selected day so the common case (add to today)
  // needs no extra tap.
  const [targetDate, setTargetDate] = useState<string | null>(
    () => useDayTasksStore.getState().selectedDate,
  );
  const today = toLocalDayKey(Date.now());

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function openDatePicker() {
    // Build: Today, Tomorrow, next 5 weekdays, then "No day yet"
    const days = Array.from({ length: 7 }, (_, i) => ({
      key: addDays(today, i),
      label: dayLabel(addDays(today, i), i),
    }));
    const options = [...days.map((d) => d.label), 'No day yet', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'When should this happen?',
        options,
        cancelButtonIndex: options.length - 1,
      },
      (idx) => {
        if (idx < days.length) {
          const chosen = days[idx];
          if (chosen) setTargetDate(chosen.key);
        } else if (idx === days.length) {
          // "No day yet" — shelf
          setTargetDate(null);
        }
        // last index = Cancel → no change
      },
    );
  }

  async function handleAddToToday() {
    const added = await a.addToToday(targetDate);
    if (!added) return;
    setToastVisible(true);
    dismissTimer.current = setTimeout(() => router.back(), toastDismissMs);
  }

  function confirmNewCategory() {
    const name = newCategory.trim();
    if (name.length > 0) a.addCategory(name);
    setNewCategory('');
    setAddingCategory(false);
  }

  // Secondary CTA mirrors the chosen day so it never lies ("Add to today" while
  // adding to Tomorrow). Shelf → "Add to shelf"; today → "Add to today"; else the
  // weekday/"Tomorrow".
  const addCtaLabel =
    targetDate === null
      ? 'Add to shelf'
      : targetDate === today
      ? 'Add to today'
      : `Add to ${targetDayLabel(targetDate, today)}`;

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };

  // "Adding to Thursday" row above the title field — always visible.
  const targetRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };
  const targetLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };
  const dateChip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1],
    backgroundColor: t.colors.surface,
  };
  const dateChipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
  };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  // inputText is kept for the inline new-category TextInput below.
  const inputText: TextStyle = {
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };

  // Quiet ✦ hint under the chips when the category was auto-guessed from the title.
  const guessHint: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    paddingHorizontal: t.space[1],
  };
  const guessHintText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };

  // Inline "new category" row — appears under the chips when "+ New" is tapped.
  const newCatRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.primary,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    paddingLeft: t.space[4],
    paddingRight: t.space[2],
    minHeight: t.size.control.sm,
  };
  const confirmCatBtn: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: t.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: newCategory.trim().length > 0 ? t.colors.primary : t.colors.surfaceSunken,
  };

  const footerStyle: ViewStyle = {
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    paddingTop: t.space[3],
    paddingBottom: insets.bottom + t.space[3],
    gap: t.space[2],
  };

  return (
    // Drawer sits below the status bar already — no top safe-area inset, or the
    // sheet gets a large empty gap above its content on Android.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, so the ScrollView+footer stack sits high with dead space below and
          the CTA floats mid-sheet. Anchor to the sheet's own height (0.95 detent) so
          the footer pins to the bottom; behavior='padding' still lifts it over the
          keyboard. */}
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: winH * 0.95 - insets.bottom }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[4] }}
          showsVerticalScrollIndicator={false}
        >
          <SheetGrabber />

          <View style={{ gap: t.space[2] }}>
            <View style={targetRow}>
              <Text style={targetLabel} accessibilityLabel={`Adding to ${targetDayLabel(targetDate, today)}`}>
                {`Adding to ${targetDayLabel(targetDate, today)}`}
              </Text>
              <Pressable
                onPress={openDatePicker}
                accessibilityRole="button"
                accessibilityLabel="Change target day"
                hitSlop={t.size.hitSlop}
              >
                <View style={dateChip}>
                  <Text style={dateChipText}>
                    {targetDate === null ? 'No day yet' : targetDayLabel(targetDate, today)}
                  </Text>
                  <Ionicons name="chevron-down" size={t.iconSize.xs} color={t.colors.inkSoft} />
                </View>
              </Pressable>
            </View>
            <Text style={heading}>New task</Text>
            <Text style={sub}>What are you working on?</Text>
          </View>

          <View style={{ gap: t.space[2] }}>
            <Text style={fieldLabel}>TASK</Text>
            <TaskTitleField
              variant="boxed"
              value={a.title}
              onChangeText={a.setTitle}
              placeholder="e.g. Reply to that email"
              returnKeyType="done"
              accessibilityLabel="Task title"
              // Title's already filled when spoken — don't grab focus over the
              // keyboard so the user can go straight to the guess field.
              autoFocus={!spokenTitle}
            />
          </View>

          <View style={{ gap: t.space[2] }}>
            <Text style={fieldLabel}>CATEGORY</Text>
            <CategoryChips
              categories={a.categories}
              value={a.category}
              onChange={a.setCategory}
              onAddNew={() => setAddingCategory(true)}
              guessedId={a.guessedCategory}
              usage={a.usage}
            />
            {a.guessedCategory && a.category === a.guessedCategory ? (
              <View style={guessHint}>
                <Ionicons name="bulb-outline" size={t.iconSize.sm} color={t.colors.primary} />
                <Text style={guessHintText}>
                  Guessed {a.categories.find((c) => c.id === a.guessedCategory)?.name} · tap to change
                </Text>
              </View>
            ) : null}
            {addingCategory ? (
              <View style={newCatRow}>
                <TextInput
                  style={[inputText, { flex: 1, paddingVertical: t.space[2] }]}
                  value={newCategory}
                  onChangeText={setNewCategory}
                  onSubmitEditing={confirmNewCategory}
                  placeholder="Name a new category"
                  placeholderTextColor={t.colors.inkSoft}
                  autoFocus
                  returnKeyType="done"
                  accessibilityLabel="New category name"
                />
                <Pressable
                  onPress={confirmNewCategory}
                  accessibilityRole="button"
                  accessibilityLabel="Add category"
                  hitSlop={6}
                  style={confirmCatBtn}
                >
                  <Ionicons
                    name="checkmark"
                    size={t.iconSize.md}
                    color={newCategory.trim().length > 0 ? t.colors.onIndigo : t.colors.inkSoft}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={{ gap: t.space[2] }}>
            <Text style={fieldLabel}>YOUR GUT GUESS</Text>
            <TimeField value={a.guessMin} onChange={a.setGuessMin} />
          </View>

          {a.suggestion ? (
            <HonestSuggestionCard
              honestMinutes={a.suggestion.honestMinutes}
              guessMinutes={a.suggestion.guessMinutes}
              confidence={a.suggestion.confidence}
              range={a.suggestion.range}
              preEstimate={a.preEstimate}
              categoryName={a.categories.find((c) => c.id === a.category)?.name}
            />
          ) : null}

          {/* One-time anti-chase coach — appears under the honest card when the
              user raises the guess toward/past the honest number. */}
          {a.antiChaseVisible ? <AntiChaseCoachCard onDismiss={a.dismissAntiChase} /> : null}

          {/* Goal coach — only when this category has an active goal. A separate
              card below the honest card; ties the honest number to the goal. */}
          {a.suggestion && a.goalCoach ? (
            <GoalCoachCard
              categoryName={a.categories.find((c) => c.id === a.category)?.name ?? ''}
              targetBand={a.goalCoach.targetBand}
              worstValue={a.goalCoach.worstValue}
              honestMinutes={a.suggestion.honestMinutes}
              guessMinutes={a.guessMin}
              onApply={a.applyHonest}
            />
          ) : null}
        </ScrollView>

        {/* Pinned CTA footer — sits in the lower-third thumb zone, rises with keyboard */}
        <View style={footerStyle}>
          <AppButton
            label="Add & start timer"
            variant="indigo"
            fullWidth
            disabled={!a.canSubmit}
            onPress={() => a.onAddAndStart(targetDate)}
          />
          <AppButton
            label={addCtaLabel}
            variant="ghost"
            fullWidth
            disabled={!a.canSubmit}
            onPress={handleAddToToday}
          />
        </View>
      </KeyboardAvoidingView>

      <Toast
        message={
          targetDate === null
            ? 'Saved to shelf'
            : targetDate === today
            ? 'Added to today'
            : `Added to ${targetDayLabel(targetDate, today)}`
        }
        visible={toastVisible}
      />
    </Screen>
  );
}
