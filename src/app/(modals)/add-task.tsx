import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions, type ViewStyle, type TextStyle } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { Toast } from '@/src/components/Toast';
import { ActionSheet, type ActionSheetItem } from '@/src/components/ActionSheet';
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
  // editId (from the queue's edit action) switches the hook + screen into edit mode.
  const { title: spokenTitle, editId } = useLocalSearchParams<{ title?: string; editId?: string }>();
  const a = useAddTask(spokenTitle, editId);
  const [toastVisible, setToastVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  // Measured height of the pinned footer. The footer is an opaque absolute overlay
  // (not a column sibling) so the native formSheet can never lay it over the scroll
  // content; the scroll content reserves this height as bottom padding so its last
  // row always clears the footer and the whole sheet stays scrollable.
  const [footerH, setFooterH] = useState(0);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Target date for the new task. Null = shelf (no day yet).
  // Initialised to the store's selected day so the common case (add to today)
  // needs no extra tap.
  const [targetDate, setTargetDate] = useState<string | null>(
    () => useDayTasksStore.getState().selectedDate,
  );
  const today = toLocalDayKey(Date.now());

  // Edit mode: adopt the task's stored day once it loads (undefined = still loading).
  useEffect(() => {
    if (a.isEditing && a.loadedDate !== undefined) setTargetDate(a.loadedDate);
  }, [a.isEditing, a.loadedDate]);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // Day options for the "when" picker: Today, Tomorrow, next 5 weekdays, then shelf.
  // Rendered via the cross-platform <ActionSheet> — ActionSheetIOS is iOS-only and
  // crashes on Android.
  const dayPickerItems: ActionSheetItem[] = [
    ...Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i);
      return { label: dayLabel(key, i), onPress: () => setTargetDate(key) };
    }),
    { label: 'No day yet', onPress: () => setTargetDate(null) },
  ];

  async function handleAddToToday() {
    const added = await a.addToToday(targetDate);
    if (!added) return;
    setToastVisible(true);
    dismissTimer.current = setTimeout(() => router.back(), toastDismissMs);
  }

  async function handleSave() {
    const ok = await a.save(targetDate);
    if (!ok) return;
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
  const promptLabel: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };

  // inputText is kept for the inline new-category TextInput below.
  const inputText: TextStyle = {
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };

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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.bg,
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    paddingTop: t.space[3],
    // Clear the bottom system inset (home indicator / gesture bar) plus a small
    // breathing gap. On Android the flex:1 column pins this footer to the true
    // screen bottom, so inset (24dp here) + space[2] lands the CTAs ~32dp up —
    // snug to the edge without sitting under the gesture bar.
    paddingBottom: insets.bottom + (Platform.OS === 'ios' ? t.space[3] : t.space[2]),
    gap: t.space[2],
  };

  return (
    // Drawer sits below the status bar already — no top safe-area inset, or the
    // sheet gets a large empty gap above its content on Android.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height. A `minHeight` here only sets a floor, so once the content (honest
          card + coaches) is taller than the sheet the column GROWS past the 0.95
          detent — the flex:1 ScrollView then expands to fit instead of scrolling, and
          the footer is pushed below the sheet where it can't be reached. A FIXED
          height caps the column at the sheet, so the ScrollView is bounded and scrolls
          while the footer stays pinned. behavior='padding' still lifts it over the
          keyboard within that fixed frame. */}
      <KeyboardAvoidingView
        // iOS: the formSheet's content area is a real 0.95 detent; rn-screens
        // collapses a flex:1 child to content height there, so pin the column to a
        // fixed height (winH·0.95 minus the home indicator) to keep the footer down.
        // Android: the sheet presents FULL-SCREEN (react-native-screens' Android
        // fallback), so a winH·0.95 cap left a permanent ~5% dead zone below the
        // pinned footer. flex:1 fills the actual presented area, so the footer pins
        // to the true bottom.
        style={Platform.OS === 'ios' ? { height: winH * 0.95 - insets.bottom } : { flex: 1 }}
        // iOS: 'padding' lifts the fixed-height column over the keyboard.
        // Android: the activity is windowSoftInputMode=adjustResize, so the native
        // window ALREADY shrinks for the keyboard — the flex:1 column shrinks with
        // it and the absolute footer rises on its own. A KAV behavior here would
        // DOUBLE-compensate: it captured the shrunken height while the keyboard was
        // up, then restored the column to that stale smaller height on dismiss,
        // leaving a large gap under the CTAs. Defer to adjustResize (undefined).
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            gap: t.space[5],
            paddingTop: t.space[3],
            // Reserve the pinned footer's height so the last row scrolls clear of it.
            paddingBottom: t.space[4] + footerH,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SheetGrabber />

          <View style={{ gap: t.space[2] }}>
            <View style={targetRow}>
              <Text style={targetLabel} accessibilityLabel={`${a.isEditing ? 'Scheduled for' : 'Adding to'} ${targetDayLabel(targetDate, today)}`}>
                {`${a.isEditing ? 'Scheduled for' : 'Adding to'} ${targetDayLabel(targetDate, today)}`}
              </Text>
              <Pressable
                onPress={() => setDatePickerVisible(true)}
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
            {a.isEditing ? (
              <>
                <Text style={heading}>Edit task</Text>
                <Text style={sub}>Adjust the details.</Text>
              </>
            ) : null}
          </View>

          <View style={{ gap: t.space[2] }}>
            <Text style={a.isEditing ? fieldLabel : promptLabel}>
              {a.isEditing ? 'TASK' : 'What are you working on?'}
            </Text>
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

          {/* Goal coach — read-only status + lever for this category's active goal.
              Never renders for free users (goals are Pro-gated at creation) and
              never depends on the guess. */}
          {a.goalCoach ? (
            <GoalCoachCard
              categoryName={a.categories.find((c) => c.id === a.category)?.name ?? ''}
              info={a.goalCoach}
            />
          ) : null}
        </ScrollView>

        {/* Pinned CTA footer — opaque absolute overlay in the lower-third thumb zone,
            rises with keyboard. Absolute (not a column sibling) so the native sheet
            can't render scroll content on top of it. */}
        <View
          style={footerStyle}
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        >
          {a.isEditing ? (
            <>
              <AppButton
                label="Save"
                variant="indigo"
                fullWidth
                disabled={!a.canSubmit || a.loadedDate === undefined}
                onPress={handleSave}
              />
              <AppButton
                label="Save & start"
                variant="ghost"
                fullWidth
                disabled={!a.canSubmit || a.loadedDate === undefined}
                onPress={() => void a.saveAndStart(targetDate)}
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Toast
        message={
          a.isEditing
            ? 'Saved'
            : targetDate === null
            ? 'Saved to shelf'
            : targetDate === today
            ? 'Added to today'
            : `Added to ${targetDayLabel(targetDate, today)}`
        }
        visible={toastVisible}
      />

      <ActionSheet
        visible={datePickerVisible}
        title="When should this happen?"
        items={dayPickerItems}
        onCancel={() => setDatePickerVisible(false)}
      />
    </Screen>
  );
}
