import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
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
import { TimeChips } from '@/src/features/shared/TimeChips';
import { GuessWheel } from '@/src/features/shared/GuessWheel';

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

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  const input: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.ink,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.md,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    minHeight: 48,
  };

  // Live honest-suggestion banner.
  const sugCard: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.md,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const sugText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary, flex: 1 };

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
          <TextInput
            style={input}
            value={a.title}
            onChangeText={a.setTitle}
            placeholder="e.g. Reply to that email"
            placeholderTextColor={t.colors.inkSoft}
            accessibilityLabel="Task title"
          />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>CATEGORY</Text>
          <CategoryChips categories={a.categories} value={a.category} onChange={a.setCategory} />
        </View>

        <View style={{ gap: t.space[2] }}>
          <Text style={fieldLabel}>YOUR GUESS</Text>
          <TimeChips value={a.guessMin} onChange={a.setGuessMin} />
          <GuessWheel value={a.guessMin} onChange={a.setGuessMin} />
        </View>

        {a.suggestion ? (
          <View style={sugCard}>
            <Ionicons name="trending-up" size={18} color={t.colors.primary} />
            <Text style={sugText}>
              honest ~{a.suggestion.honestMinutes} min · {a.suggestion.label}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: t.space[2], paddingTop: t.space[2] }}>
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
