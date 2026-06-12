import { useState } from 'react';
import { View, ScrollView, Modal, TextInput } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { Chip } from '@/src/components/Chip';
import { formatClock } from '@/src/lib/time';
import { CATEGORY_NAMES } from '@/src/engine';
import { usePlanner, type ReprojectDiff } from '@/src/features/planner/usePlanner';
import { DeadlinePicker } from '@/src/features/planner/DeadlinePicker';
import { BufferChips } from '@/src/features/planner/BufferChips';
import { TaskRow } from '@/src/features/planner/TaskRow';
import { PlanTimeline } from '@/src/features/planner/PlanTimeline';
import { VerdictCard } from '@/src/features/planner/VerdictCard';

const CATEGORY_IDS = Object.keys(CATEGORY_NAMES);

// ──────────────────────────────────────────────────────────────────────────────
// Plan — the reverse Start-By day planner (free in the MVP; no paywall here).
// Compose a deadline + ordered tasks (durations pre-filled from learned data),
// build a backward-pass plan, and act on the kind "cut one" verdict. An active
// plan can be re-projected, but only applies on explicit confirm (diff sheet).
// ──────────────────────────────────────────────────────────────────────────────

export default function Plan() {
  const t = useTheme();
  const planner = usePlanner();
  const {
    draft,
    result,
    active,
    setDeadline,
    setBuffer,
    addTask,
    updateTaskDuration,
    removeTask,
    reorderTasks,
    cut,
    pushDeadline,
    saveActive,
    reproject,
  } = planner;

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<string>(CATEGORY_IDS[0] ?? 'admin');
  const [diff, setDiff] = useState<ReprojectDiff | null>(null);
  const [saved, setSaved] = useState(false);

  function commitNewTask() {
    const label = newLabel.trim();
    if (!label) return;
    addTask({ label, category: newCategory });
    setNewLabel('');
    setAdding(false);
  }

  function move(id: string, dir: -1 | 1) {
    const ids = draft.tasks.map((task) => task.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorderTasks(ids);
  }

  function onSave() {
    saveActive();
    setSaved(true);
  }

  function openReproject() {
    const d = reproject();
    if (d) setDiff(d);
  }

  function applyReproject() {
    // The diff already reflects the active plan against `now`. "Applying" just
    // re-saves the active plan with the current clock so its createdAt anchor
    // advances; the timeline shown in the sheet is what the user confirmed.
    saveActive();
    setDiff(null);
  }

  const hasDeadline = draft.deadline !== null;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: t.space[5], paddingTop: t.space[4], paddingBottom: t.space[12] }}>
        <View style={{ gap: t.space[1] }}>
          <AppText variant="label" style={{ color: t.colors.primary }}>
            ● Start-By Plan
          </AppText>
          <AppText variant="display">Plan backward</AppText>
          <AppText variant="caption">
            Pick a finish time and your tasks — Whenbee says when to start, honestly.
          </AppText>
        </View>

        <DeadlinePicker now={planner.now} value={draft.deadline} onChange={setDeadline} />

        <BufferChips value={draft.bufferMin} onChange={setBuffer} />

        {/* Ordered task list */}
        <View style={{ gap: t.space[2] }}>
          <AppText variant="label">Tasks ({draft.tasks.length})</AppText>
          {draft.tasks.map((task, i) => (
            <TaskRow
              key={task.id}
              label={task.label}
              category={task.category}
              durationMin={task.durationMin}
              isFirst={i === 0}
              isLast={i === draft.tasks.length - 1}
              onChangeDuration={(next) => updateTaskDuration(task.id, next)}
              onMoveUp={() => move(task.id, -1)}
              onMoveDown={() => move(task.id, 1)}
              onRemove={() => removeTask(task.id)}
            />
          ))}

          {adding ? (
            <Card style={{ gap: t.space[3] }}>
              <AppText variant="label">New task</AppText>
              <LabelField value={newLabel} onChange={setNewLabel} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
                {CATEGORY_IDS.map((id) => (
                  <Chip
                    key={id}
                    label={CATEGORY_NAMES[id] ?? id}
                    selected={newCategory === id}
                    onPress={() => setNewCategory(id)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: t.space[3] }}>
                <AppButton label="Add" variant="indigo" onPress={commitNewTask} />
                <AppButton label="Cancel" variant="ghost" onPress={() => setAdding(false)} />
              </View>
            </Card>
          ) : (
            <Chip label="+ Add task" variant="add" onPress={() => setAdding(true)} />
          )}
        </View>

        {/* THE ONE primary action */}
        {hasDeadline && (
          <AppButton
            label="Build my plan"
            variant="indigo"
            fullWidth
            onPress={() => setSaved(false)}
          />
        )}

        {/* Result */}
        {result && draft.deadline !== null && (
          <View style={{ gap: t.space[4] }}>
            <Card>
              <Headline verdictKind={result.verdict.kind} startBy={result.startBy} deadline={draft.deadline} feasible={result.verdict.kind === 'push-deadline' ? result.verdict.feasibleDeadline : null} />
            </Card>

            <PlanTimeline items={result.timeline} />

            <VerdictCard
              verdict={result.verdict}
              deadline={draft.deadline}
              onCut={cut}
              onPush={pushDeadline}
            />

            <View style={{ flexDirection: 'row', gap: t.space[3] }}>
              <AppButton label="Save plan" variant="ghost" onPress={onSave} />
              {saved && active && (
                <AppButton label="I'm behind / re-project" variant="ghost" onPress={openReproject} />
              )}
            </View>
            {saved && (
              <AppText variant="caption" style={{ color: t.colors.success }}>
                Saved. We&apos;ll keep this plan until you change it.
              </AppText>
            )}
          </View>
        )}
      </ScrollView>

      {/* Re-project diff + confirm sheet — never silently reshuffles */}
      <ReprojectSheet
        diff={diff}
        deadline={active?.deadline ?? draft.deadline ?? 0}
        onCancel={() => setDiff(null)}
        onConfirm={applyReproject}
      />
    </Screen>
  );
}

/** A minimal controlled text label, built from primitives (no new dep). */
function LabelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="e.g. Make breakfast"
      placeholderTextColor={t.colors.inkSoft}
      style={{
        borderWidth: t.borderWidth.hairline,
        borderColor: t.colors.hairline,
        borderRadius: t.radii.md,
        paddingHorizontal: t.space[3],
        paddingVertical: t.space[3],
        color: t.colors.ink,
        fontSize: t.fontSize.base,
        minHeight: 44,
      }}
    />
  );
}

function Headline({
  verdictKind,
  startBy,
  deadline,
  feasible,
}: {
  verdictKind: string;
  startBy: number;
  deadline: number;
  feasible: number | null;
}) {
  const t = useTheme();
  if (verdictKind === 'push-deadline' && feasible !== null) {
    return (
      <AppText variant="title" style={{ color: t.colors.amberText }}>
        Won&apos;t fit by {formatClock(deadline)} — finish by {formatClock(feasible)} or cut tasks
      </AppText>
    );
  }
  return (
    <AppText variant="title">
      Start by{' '}
      <AppText variant="title" style={{ color: t.colors.primary, fontVariant: ['tabular-nums'] }}>
        {formatClock(startBy)}
      </AppText>{' '}
      to finish by {formatClock(deadline)}
    </AppText>
  );
}

function ReprojectSheet({
  diff,
  deadline,
  onCancel,
  onConfirm,
}: {
  diff: ReprojectDiff | null;
  deadline: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={diff !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim }}>
        <View
          style={{
            backgroundColor: t.colors.bg,
            borderTopLeftRadius: t.radii.sheet,
            borderTopRightRadius: t.radii.sheet,
            padding: t.space[5],
            gap: t.space[4],
          }}
        >
          <AppText variant="title">Re-project your day</AppText>
          {diff && (
            <View style={{ gap: t.space[4] }}>
              <View style={{ flexDirection: 'row', gap: t.space[6] }}>
                <View style={{ gap: t.space[0.5] }}>
                  <AppText variant="caption">Was starting</AppText>
                  <AppText variant="body" style={{ fontVariant: ['tabular-nums'] }}>
                    {formatClock(diff.oldStartBy)}
                  </AppText>
                </View>
                <View style={{ gap: t.space[0.5] }}>
                  <AppText variant="caption">Now starts</AppText>
                  <AppText variant="body" style={{ color: t.colors.amberText, fontVariant: ['tabular-nums'] }}>
                    {diff.newResult.verdict.kind === 'push-deadline'
                      ? `finish ${formatClock(diff.newResult.verdict.feasibleDeadline)}`
                      : formatClock(diff.newResult.startBy)}
                  </AppText>
                </View>
              </View>

              <View style={{ gap: t.space[2] }}>
                <AppText variant="label">New timeline</AppText>
                <PlanTimeline items={diff.newResult.timeline} />
              </View>

              <VerdictCardLite verdict={diff.newResult.verdict} deadline={deadline} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: t.space[3] }}>
            <AppButton label="Apply" variant="indigo" onPress={onConfirm} />
            <AppButton label="Keep current" variant="ghost" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A read-only verdict summary line inside the sheet (no action buttons). */
function VerdictCardLite({ verdict, deadline }: { verdict: ReprojectDiff['newResult']['verdict']; deadline: number }) {
  const t = useTheme();
  let msg = '';
  if (verdict.kind === 'fits') msg = `Still fits — start by ${formatClock(verdict.startBy)}.`;
  else if (verdict.kind === 'cut-one') msg = `Cut ${verdict.cut.label} to stay on time.`;
  else if (verdict.kind === 'multi-cut') msg = `Cut ${verdict.cuts.map((c) => c.label).join(', ')} to stay on time.`;
  else msg = `Won't fit by ${formatClock(deadline)} — finish by ${formatClock(verdict.feasibleDeadline)} or cut tasks.`;
  const tone = verdict.kind === 'fits' ? t.colors.ink : t.colors.amberText;
  return (
    <Card style={verdict.kind === 'fits' ? undefined : { backgroundColor: t.colors.accentSoft, borderColor: t.colors.accentEdge }}>
      <AppText variant="body" style={{ color: tone }}>
        {msg}
      </AppText>
    </Card>
  );
}
