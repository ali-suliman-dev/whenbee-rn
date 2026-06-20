import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { Toast } from '@/src/components/Toast';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useAddTask } from '@/src/features/add-task/useAddTask';
import { CategoryChips } from '@/src/features/shared/CategoryChips';
import { TimeField } from '@/src/features/shared/TimeField';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';

// ──────────────────────────────────────────────────────────────────────────────
// Add Task (Screen 10, formSheet) — add an ad-hoc task and surface the honest
// suggestion LIVE (guess × learned multiplier) at the decision moment.
//   • Add & start timer → Timer with the honest estimate + original guess.
//   • Add to today → queue it, toast "Added to today", dismiss.
// Actions gate gently on title + category (no scold).
// ──────────────────────────────────────────────────────────────────────────────

export default function AddTask() {
  const t = useTheme();
  const toastDismissMs = t.motion.pulse; // let the toast land before the sheet closes
  const a = useAddTask();
  const [toastVisible, setToastVisible] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  function handleAddToToday() {
    if (!a.addToToday()) return;
    setToastVisible(true);
    dismissTimer.current = setTimeout(() => router.back(), toastDismissMs);
  }

  function confirmNewCategory() {
    const name = newCategory.trim();
    if (name.length > 0) a.addCategory(name);
    setNewCategory('');
    setAddingCategory(false);
  }

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  // Dedicated input text style: fontFamily + size only, NO lineHeight. A lineHeight
  // on a single-line iOS TextInput clips descenders (g/y/p) at the box bottom — the
  // platform's natural line metrics leave the descender room.
  const inputText: TextStyle = {
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };
  const inputBox = (focused: boolean): ViewStyle => ({
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: focused ? t.colors.primary : t.colors.hairline,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    minHeight: t.size.control.md,
  });

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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[3], paddingBottom: t.space[6] }}
        showsVerticalScrollIndicator={false}
      >
        <SheetGrabber />

        <View style={{ gap: t.space[1] }}>
          <Text style={heading}>New task</Text>
          <Text style={sub}>What are you working on?</Text>
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>TASK</Text>
          <View style={inputBox(titleFocused)}>
            <Ionicons
              name="create-outline"
              size={t.iconSize.md}
              color={titleFocused ? t.colors.primary : t.colors.inkSoft}
            />
            <TextInput
              style={[inputText, { flex: 1, paddingVertical: t.space[3] }]}
              value={a.title}
              onChangeText={a.setTitle}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              placeholder="e.g. Reply to that email"
              placeholderTextColor={t.colors.inkSoft}
              returnKeyType="done"
              accessibilityLabel="Task title"
            />
          </View>
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
          <Text style={fieldLabel}>YOUR GUESS</Text>
          <TimeField value={a.guessMin} onChange={a.setGuessMin} />
        </View>

        {a.suggestion ? (
          <HonestSuggestionCard
            honestMinutes={a.suggestion.honestMinutes}
            guessMinutes={a.suggestion.guessMinutes}
            confidence={a.suggestion.confidence}
            range={a.suggestion.range}
          />
        ) : null}

        <View style={{ gap: t.space[2], marginTop: -t.space[3] }}>
          <AppButton
            label="Add & start timer"
            variant="indigo"
            fullWidth
            disabled={!a.canSubmit}
            onPress={a.onAddAndStart}
          />
          <AppButton
            label="Add to today"
            variant="ghost"
            fullWidth
            disabled={!a.canSubmit}
            onPress={handleAddToToday}
          />
        </View>
      </ScrollView>

      <Toast message="Added to today" visible={toastVisible} />
    </Screen>
  );
}
