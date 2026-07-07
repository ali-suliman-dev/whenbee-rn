// src/features/routines/StepEditorSheet.tsx
//
// In-surface overlay sheet for adding or editing one routine step.
// Modelled on ConfirmSheet — backdrop + sheet panel, no modal route.
// Visible prop gates rendering; the sheet opens/closes by swapping state
// in the parent (RoutineBuildView). FadeIn only — no spring/bounce/translate.

import { useEffect, useState, type ReactElement } from 'react';
import {
  KeyboardAvoidingView,
  StyleSheet,
  View,
  Pressable,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { tokens } from '@/src/theme/tokens';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { DurationWheel } from '@/src/features/planner/DurationWheel';
import { CategoryChips, usePickerCategories } from '@/src/features/shared/CategoryChips';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { seedGuessForCategory, DEFAULT_STEP_GUESS } from './calibrationSeed';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface StepDraft {
  label: string;
  category: string;
  guessMin: number;
}

interface StepEditorSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  initial?: { label: string; category: string; guessMin: number } | null;
  onSubmit: (step: StepDraft) => void;
  onCancel: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Animation — opacity FadeIn only; no spring/bounce/translate
// ──────────────────────────────────────────────────────────────────────────────

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function StepEditorSheet({
  visible,
  mode,
  initial,
  onSubmit,
  onCancel,
}: StepEditorSheetProps): ReactElement | null {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const categories = usePickerCategories();
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [label, setLabel] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [guessed, setGuessed] = useState<string | null>(null);
  const [guessMin, setGuessMin] = useState(DEFAULT_STEP_GUESS);

  // Reset local state each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setLabel(initial?.label ?? '');
    setCategory(initial?.category ?? null);
    setGuessed(null);
    setGuessMin(initial?.guessMin ?? DEFAULT_STEP_GUESS);
  }, [visible, initial]);

  if (!visible) return null;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleTitleChange = (v: string) => {
    setLabel(v);
    const guess = guessCategory(v, {
      namedCats: categories,
      availableIds: categories.map((c) => c.id),
    });
    setGuessed(guess);
    if (category === null && guess !== null) setCategory(guess);
  };

  const handlePickCategory = (id: string) => {
    setCategory(id);
    const seeded = seedGuessForCategory(id, statsByCategory);
    if (seeded !== DEFAULT_STEP_GUESS) setGuessMin(seeded);
  };

  const canSubmit = label.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ label: label.trim(), category: category ?? 'admin', guessMin });
  };

  // ─── Styles ─────────────────────────────────────────────────────────────────

  const backdrop: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    // The Routines route pads its surface by t.space[5] (see (tabs)/routines.tsx),
    // which would inset this overlay. Cancel it so the sheet is full-bleed edge-to-edge.
    left: -t.space[5],
    right: -t.space[5],
    backgroundColor: t.colors.scrim,
  };
  // KeyboardAvoidingView pins the sheet to the bottom and, on keyboard-open,
  // pads by the REAL keyboard↔sheet overlap (adjustResize is neutralised by
  // edge-to-edge, so the OS won't lift it and useAnimatedKeyboard over-lifts).
  const avoider: ViewStyle = { flex: 1, justifyContent: 'flex-end' };
  const sheet: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radii.sheet,
    borderTopRightRadius: t.radii.sheet,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    // Android renders no SheetGrabber, so add explicit top breathing room.
    paddingTop: t.space[5],
    paddingBottom: t.space[6],
    gap: t.space[4],
  };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  // Sunken field bg so the input reads as a distinct well on the surface sheet
  // (surface-on-surface would be invisible).
  const fieldStyle: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderColor: t.colors.hairline,
  };
  // Compact actions, anchored to the right edge of the sheet.
  const actions: ViewStyle = { flexDirection: 'row', justifyContent: 'flex-end', gap: t.space[2] };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Animated.View style={backdrop} entering={ENTER}>
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={onCancel}
        accessibilityLabel="Dismiss"
      />
      <KeyboardAvoidingView
        style={avoider}
        behavior="padding"
        keyboardVerticalOffset={insets.bottom + t.space[5]}
      >
        <View style={sheet}>
          <SheetGrabber />
        <AppText style={titleStyle}>{mode === 'add' ? 'Add a step' : 'Edit step'}</AppText>
        <TaskTitleField
          variant="boxed"
          value={label}
          onChangeText={handleTitleChange}
          placeholder="Step name"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          containerStyle={fieldStyle}
        />
        <CategoryChips
          categories={categories}
          value={category}
          onChange={handlePickCategory}
          guessedId={guessed}
        />
        <DurationWheel valueMin={guessMin} onChange={setGuessMin} fullWidth />
        <View style={actions}>
          <AppButton label="Cancel" variant="ghost" size="2xs" onPress={onCancel} />
          <AppButton
            label={mode === 'add' ? 'Add step' : 'Save step'}
            variant="indigo"
            size="2xs"
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
        </View>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
