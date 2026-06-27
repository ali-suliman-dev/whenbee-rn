import { useMemo, useReducer } from 'react';
import { ScrollView, View, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
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

export function RoutineBuildView({ onDone }: { onDone: () => void }) {
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

  const nameStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  const dock: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
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
        {/* Name = the routine title */}
        <TaskTitleField
          variant="underline"
          value={draft.name}
          onChangeText={setName}
          placeholder="Name this routine"
          returnKeyType="done"
          textStyle={nameStyle}
        />

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
            fullWidth
            onPress={() => setSheet({ kind: 'step', editId: null })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppButton
            label="Save"
            variant="indigo"
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
