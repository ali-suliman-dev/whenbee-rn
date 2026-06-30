import { useMemo, useReducer } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { TaskTitleField } from '@/src/components/TaskTitleField';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { priorFor, TRANSITION_PRIOR } from '@/src/engine';
import { buildRoutineRail } from './routineRailModel';
import { RoutineRail } from './RoutineRail';
import { AnimatedHonestTotal } from './AnimatedHonestTotal';
import { StepEditorSheet, type StepDraft } from './StepEditorSheet';
import { FinishEditorSheet } from './FinishEditorSheet';

const MS_PER_MIN = 60_000;

// Which editor sheet is open. `editId` null in 'step' mode = adding.
type SheetState =
  | { kind: 'none' }
  | { kind: 'step'; editId: string | null }
  | { kind: 'finish' };

function sheetReducer(_state: SheetState, next: SheetState): SheetState {
  return next;
}

export function RoutineBuildView({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const draft = useRoutinesStore((s) => s.draft);
  const setName = useRoutinesStore((s) => s.setName);
  const addStep = useRoutinesStore((s) => s.addStep);
  const editStep = useRoutinesStore((s) => s.editStep);
  const removeStep = useRoutinesStore((s) => s.removeStep);
  const setDoneBy = useRoutinesStore((s) => s.setDoneBy);
  const saveDraft = useRoutinesStore((s) => s.saveDraft);
  const statsByCategory = useCalibrationStore((s) => s.statsByCategory);

  const [sheet, setSheet] = useReducer(sheetReducer, { kind: 'none' } as SheetState);

  const mFor = (c: string) => statsByCategory[c]?.mEffective ?? priorFor(c);

  const model = useMemo(
    () =>
      buildRoutineRail({
        steps: draft.steps,
        mFor,
        transitionFactor: TRANSITION_PRIOR,
        doneByMinuteOfDay: draft.doneByMinuteOfDay,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.steps, draft.doneByMinuteOfDay, statsByCategory],
  );

  const canSave = draft.name.trim().length > 0 && draft.steps.length > 0;

  const editing = useMemo(
    () =>
      sheet.kind === 'step' && sheet.editId !== null
        ? draft.steps.find((s) => s.id === sheet.editId) ?? null
        : null,
    // Recompute only when which step is open changes, not on every draft.steps mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet.kind === 'step' ? sheet.editId : null],
  );

  const handleStepSubmit = (step: StepDraft) => {
    if (sheet.kind === 'step' && sheet.editId !== null) {
      editStep(sheet.editId, step);
    } else {
      addStep(step);
    }
    setSheet({ kind: 'none' });
  };

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

  // Routine name = an editable title. One step down from subtitle (per founder),
  // with an eyebrow label + a visible resting underline so it reads as a field.
  const nameStyle: TextStyle = { ...(type.titleSm as unknown as TextStyle), color: t.colors.ink };
  const fieldLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const nameField: ViewStyle = { borderColor: t.colors.border };

  const backRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    alignSelf: 'flex-start',
  };
  const backLabel: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  // The hosting route already pads the surface horizontally, so the dock only
  // owns its vertical rhythm + safe-area inset — no second horizontal pad.
  const dock: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingTop: t.space[3],
    paddingBottom: insets.bottom + t.space[3],
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    backgroundColor: t.colors.bg,
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          gap: t.space[4],
          paddingHorizontal: t.space[4],
          paddingTop: t.space[3],
          paddingBottom: t.space[8],
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back to the routines list — iOS chevron + previous-screen name */}
        <Pressable
          onPress={onBack}
          hitSlop={t.size.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Back to routines"
          style={backRow}
        >
          <Ionicons name="chevron-back" size={t.iconSize.md} color={t.colors.inkSoft} />
          <AppText style={backLabel}>Routines</AppText>
        </Pressable>

        {/* Name = the routine title — labelled + underlined so it reads as a field */}
        <View style={{ gap: t.space[1] }}>
          <AppText style={fieldLabel}>Routine name</AppText>
          <TaskTitleField
            variant="underline"
            value={draft.name}
            onChangeText={setName}
            placeholder="Name this routine"
            returnKeyType="done"
            textStyle={nameStyle}
            containerStyle={nameField}
          />
        </View>

        <AnimatedHonestTotal minutes={model.honestTotalMin} />

        <RoutineRail
          model={model}
          onEditStep={(id) => setSheet({ kind: 'step', editId: id })}
          onDeleteStep={removeStep}
          onAddStep={() => setSheet({ kind: 'step', editId: null })}
          onEditFinish={() => setSheet({ kind: 'finish' })}
        />
      </ScrollView>

      {/* Thumb-zone dock — secondary (＋ Step) left, primary (Save) right */}
      <View style={dock}>
        <View style={{ flex: 1 }}>
          <AppButton
            label="＋ Step"
            variant="ghost"
            size="2xs"
            fullWidth
            onPress={() => setSheet({ kind: 'step', editId: null })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Save"
            variant="indigo"
            size="2xs"
            fullWidth
            disabled={!canSave}
            onPress={() => {
              void saveDraft().then(onDone);
            }}
            accessibilityLabel={
              canSave ? 'Save routine' : 'Add a name and at least one step to save'
            }
          />
        </View>
      </View>

      <StepEditorSheet
        visible={sheet.kind === 'step'}
        mode={editing ? 'edit' : 'add'}
        initial={editing}
        onSubmit={handleStepSubmit}
        onCancel={() => setSheet({ kind: 'none' })}
      />
      <FinishEditorSheet
        visible={sheet.kind === 'finish'}
        valueMs={doneByMs}
        onChange={handleDoneByChange}
        onClear={() => {
          setDoneBy(null);
          setSheet({ kind: 'none' });
        }}
        onClose={() => setSheet({ kind: 'none' })}
      />
    </View>
  );
}
