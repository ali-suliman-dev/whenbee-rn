import { useMemo, useReducer } from 'react';
import { ScrollView, View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { CategoryChips, usePickerCategories } from '@/src/features/shared/CategoryChips';
import { guessCategory } from '@/src/features/shared/categoryGuess';
import { DurationWheel } from '@/src/features/planner/DurationWheel';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';
import {
  stepHonestMinutes,
  routineHonestTotal,
  priorFor,
  TRANSITION_PRIOR,
} from '@/src/engine';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// RoutineBuildView — name a routine, add ordered steps, set an optional be-done-by
// anchor, and watch the running honest total (per-step honest × transition factor).
// Tapping a step's duration edits the GUESS (DurationWheel); the honest number is
// derived read-only. Save is disabled until name + ≥1 step. No-guilt, amber-free.
// (Spec §5.2 / §10.) Per-step honest = round5(guess × M_category | recurring).
// ──────────────────────────────────────────────────────────────────────────────

const MS_PER_MIN = 60_000;

type ComposerState = { open: boolean; title: string; category: string | null; guessed: string | null };
type ComposerAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'setTitleAndGuess'; value: string; guess: string | null }
  | { type: 'setTitle'; value: string }
  | { type: 'setCategory'; id: string };

function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'open':
      return { open: true, title: '', category: null, guessed: null };
    case 'close':
      return { open: false, title: '', category: null, guessed: null };
    case 'setTitleAndGuess':
      return { ...state, title: action.value, category: action.guess, guessed: action.guess };
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setCategory':
      return { ...state, category: action.id, guessed: null };
    default:
      return state;
  }
}

export function RoutineBuildView({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const categories = usePickerCategories();

  const draft = useRoutinesStore((s) => s.draft);
  const setName = useRoutinesStore((s) => s.setName);
  const setDoneBy = useRoutinesStore((s) => s.setDoneBy);
  const addStep = useRoutinesStore((s) => s.addStep);
  const editStep = useRoutinesStore((s) => s.editStep);
  const removeStep = useRoutinesStore((s) => s.removeStep);
  const saveDraft = useRoutinesStore((s) => s.saveDraft);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [composer, dispatch] = useReducer(composerReducer, {
    open: false,
    title: '',
    category: null,
    guessed: null,
  });

  const categoryM = (category: string): number =>
    statsByCategory[category]?.mEffective ?? priorFor(category);

  // Live honest total: per-step honest × the prior transition factor (a fresh draft
  // has no learned factor; the displayed total moves with composition, not regression).
  const honestTotal = useMemo(() => {
    const perStep = draft.steps.map((s) => stepHonestMinutes(s.guessMin, categoryM(s.category)));
    return routineHonestTotal(perStep, TRANSITION_PRIOR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.steps, statsByCategory]);

  const canSave = draft.name.trim().length > 0 && draft.steps.length > 0;

  const handleAddStep = () => {
    const label = composer.title.trim();
    if (!label) return;
    addStep({ label, category: composer.category ?? 'admin', guessMin: 15 });
    dispatch({ type: 'close' });
  };

  const handleTitleChange = (v: string) => {
    const guess = guessCategory(v, { namedCats: categories, availableIds: categories.map((c) => c.id) });
    dispatch({ type: 'setTitleAndGuess', value: v, guess });
  };

  // Minute-of-day → an epoch on today (the FinishTimeWheel speaks epoch ms).
  const doneByMs = useMemo(() => {
    if (draft.doneByMinuteOfDay === null) return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() + draft.doneByMinuteOfDay * MS_PER_MIN;
  }, [draft.doneByMinuteOfDay]);

  const handleDoneByChange = (ms: number) => {
    const d = new Date(ms);
    setDoneBy(d.getHours() * 60 + d.getMinutes());
  };

  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const title: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const totalNum: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.ink };
  const caption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  const addRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    borderStyle: 'dashed',
    borderRadius: t.radii.card,
    padding: t.space[4],
  };
  const addLabel: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.primary,
  };
  const composerCard: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
  };

  return (
    <ScrollView
      contentContainerStyle={{ gap: t.space[4], paddingTop: t.space[3], paddingBottom: insets.bottom + t.space[8] }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={headerRow}>
        <AppText style={title}>{draft.editingId ? 'Edit routine' : 'New routine'}</AppText>
        <AppButton label="Save" variant="indigo" size="sm" disabled={!canSave} onPress={() => { void saveDraft().then(onDone); }} />
      </View>

      <TaskTitleField
        variant="underline"
        value={draft.name}
        onChangeText={setName}
        placeholder="Name this routine"
        returnKeyType="done"
      />

      <View style={{ gap: t.space[0.5] }}>
        <AppText style={totalNum}>About {honestTotal} min</AppText>
        <AppText style={caption}>including the in-between time</AppText>
      </View>

      {/* Steps */}
      <View style={{ gap: t.space[2] }}>
        {draft.steps.map((step) => (
          <StepRow
            key={step.id}
            label={step.label}
            category={step.category}
            honestMin={stepHonestMinutes(step.guessMin, categoryM(step.category))}
            guessMin={step.guessMin}
            onGuessChange={(min) => editStep(step.id, { guessMin: min })}
            onRemove={() => removeStep(step.id)}
          />
        ))}

        {composer.open ? (
          <View style={composerCard}>
            <TaskTitleField
              variant="underline"
              value={composer.title}
              onChangeText={handleTitleChange}
              placeholder="Step name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddStep}
            />
            <CategoryChips
              categories={categories}
              value={composer.category}
              onChange={(id) => dispatch({ type: 'setCategory', id })}
              guessedId={composer.guessed}
            />
            <View style={{ flexDirection: 'row', gap: t.space[2] }}>
              <AppButton label="Add step" variant="indigo" size="xs" disabled={!composer.title.trim()} onPress={handleAddStep} />
              <AppButton label="Cancel" variant="ghost" size="xs" onPress={() => dispatch({ type: 'close' })} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => dispatch({ type: 'open' })} accessibilityRole="button" accessibilityLabel="Add a step">
            <View style={addRow}>
              <AppText style={addLabel}>＋ Add step</AppText>
            </View>
          </Pressable>
        )}
      </View>

      {/* Be done by (optional) */}
      <View style={{ gap: t.space[2] }}>
        <View style={headerRow}>
          <AppText style={fieldLabel}>BE DONE BY</AppText>
          {draft.doneByMinuteOfDay !== null ? (
            <Pressable onPress={() => setDoneBy(null)} hitSlop={t.space[2]} accessibilityRole="button" accessibilityLabel="Clear be done by">
              <AppText style={caption}>Clear</AppText>
            </Pressable>
          ) : null}
        </View>
        <FinishTimeWheel valueMs={doneByMs} mode="be done by" showModes={false} onChange={handleDoneByChange} />
      </View>
    </ScrollView>
  );
}

function StepRow({
  label,
  category,
  honestMin,
  guessMin,
  onGuessChange,
  onRemove,
}: {
  label: string;
  category: string;
  honestMin: number;
  guessMin: number;
  onGuessChange: (min: number) => void;
  onRemove: () => void;
}) {
  const t = useTheme();
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.space[3],
    gap: t.space[3],
    minHeight: t.size.planCardMin,
  };
  const body: ViewStyle = { flex: 1, minWidth: 0, gap: t.space[0.5] };
  const titleStyle: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const catStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const honest: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, fontVariant: ['tabular-nums'] };
  const remove: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };

  return (
    <View style={card}>
      <View style={body}>
        <AppText style={titleStyle} numberOfLines={1}>{label}</AppText>
        <View style={{ flexDirection: 'row', gap: t.space[2] }}>
          <AppText style={catStyle} numberOfLines={1}>{category}</AppText>
          <AppText style={honest}>{honestMin}m honest</AppText>
        </View>
      </View>
      <DurationWheel valueMin={guessMin} onChange={onGuessChange} />
      <Pressable onPress={onRemove} hitSlop={t.space[2]} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
        <AppText style={remove}>Remove</AppText>
      </Pressable>
    </View>
  );
}
