import { useState } from 'react';
import { View, ScrollView, Modal, TextInput } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { Screen } from '@/src/components/Screen';
import { ActiveTimerBar } from '@/src/components/ActiveTimerBar';
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
import { ShareableCard, type ShareCardData } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import type { PlanResult, PlanVerdict } from '@/src/domain/types';
import type { TextStyle } from 'react-native';

const CATEGORY_IDS = Object.keys(CATEGORY_NAMES);

// ──────────────────────────────────────────────────────────────────────────────
// Plan — the reverse Start-By day planner (free in the MVP; no paywall here).
// One clear job per block: a finish time, breathing room, the tasks, then a single
// "Build my plan" that reveals ONE consolidated result — the Start-By time as the
// focal answer, the timeline, and a single calm verdict. No amber here: amber is
// reserved for honey/reward, so the over-cases read as a neutral heads-up.
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
    cutTasks,
    pushDeadline,
    saveActive,
    reproject,
  } = planner;

  const planShare = useShareCard('plan');

  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState<string>(CATEGORY_IDS[0] ?? 'admin');
  const [diff, setDiff] = useState<ReprojectDiff | null>(null);
  const [saved, setSaved] = useState(false);
  // The result stays hidden until the user explicitly builds — visibility of system
  // status + real user control (the button had no job before). Once built, edits to
  // tasks/deadline keep the result live (it's reactive).
  const [built, setBuilt] = useState(false);

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
    saveActive();
    setDiff(null);
  }

  const hasDeadline = draft.deadline !== null;
  const showResult = built && result !== null && draft.deadline !== null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[6], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: t.space[1] }}>
          <AppText variant="label" style={{ color: t.colors.primary }}>
            ● Start-By Plan
          </AppText>
          <AppText variant="display">Plan backward</AppText>
          <AppText variant="caption">
            Pick a finish time and your tasks — Whenbee says when to start, honestly.
          </AppText>
        </View>

        <ActiveTimerBar />

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
              {/* Balanced pair — identical structure, equal flex, shared baseline. */}
              <View style={{ flexDirection: 'row', gap: t.space[3] }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Add" variant="indigo" size="sm" fullWidth onPress={commitNewTask} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton label="Cancel" variant="ghost" size="sm" fullWidth onPress={() => setAdding(false)} />
                </View>
              </View>
            </Card>
          ) : (
            <Chip label="+ Add task" variant="add" onPress={() => setAdding(true)} />
          )}
        </View>

        {/* THE primary action — reveals the result */}
        {hasDeadline && (
          <AppButton
            label="Build my plan"
            variant="indigo"
            fullWidth
            onPress={() => {
              setBuilt(true);
              setSaved(false);
            }}
          />
        )}

        {/* Result — one consolidated block */}
        {showResult && result && draft.deadline !== null && (
          <View style={{ gap: t.space[4] }}>
            <StartByHero verdict={result.verdict} startBy={result.startBy} deadline={draft.deadline} />

            <PlanTimeline items={result.timeline} />

            <VerdictCard
              verdict={result.verdict}
              deadline={draft.deadline}
              onCut={cutTasks}
              onPush={pushDeadline}
            />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] }}>
              <AppButton label="Save plan" variant="ghost" size="md" onPress={onSave} />
              <AppButton label="Share this plan" variant="ghost" size="md" onPress={planShare.onShare} />
              {saved && active && (
                <AppButton label="I'm behind / re-project" variant="ghost" size="md" onPress={openReproject} />
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

      {/* Off-screen capture card — rendered for react-native-view-shot only, never
          visible (positioned off-canvas, no touch). Mounts only with a real result. */}
      {showResult && result && draft.deadline !== null && (
        <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
          <ShareableCard ref={planShare.ref} data={planShareData(result, draft.deadline)} />
        </View>
      )}

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
        minHeight: t.size.control.sm,
      }}
    />
  );
}

/**
 * Map a finished plan to the off-screen share card. Mirrors StartByHero's verdict
 * logic so the shared image leads with the same focal time the user sees: a feasible
 * finish for "push-deadline", otherwise the honest start-by.
 */
function planShareData(result: PlanResult, deadline: number): ShareCardData {
  const { verdict } = result;
  const isPush = verdict.kind === 'push-deadline';
  return {
    kind: 'plan',
    focalClock: isPush ? verdict.feasibleDeadline : result.startBy,
    eyebrow: isPush ? 'FINISH BY' : 'START BY',
    deadlineClock: deadline,
    timeline: result.timeline,
  };
}

/**
 * Start-By hero — the screen's actual answer, with the time as the focal number.
 * "fits"/"cut" cases lead with the start-by time; the "push-deadline" case has no
 * feasible start at the chosen deadline, so it leads with the earliest finish that
 * fits. Neutral throughout (the time is indigo — the hero accent — never amber).
 */
function StartByHero({
  verdict,
  startBy,
  deadline,
}: {
  verdict: PlanVerdict;
  startBy: number;
  deadline: number;
}) {
  const t = useTheme();
  const isPush = verdict.kind === 'push-deadline';
  const focal = isPush ? verdict.feasibleDeadline : startBy;
  const eyebrow = isPush ? 'FINISH BY' : 'START BY';
  const sub = isPush ? 'the earliest everything fits' : `to finish by ${formatClock(deadline)}`;

  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const focalStyle: TextStyle = { ...(type.honestNumberXl as unknown as TextStyle), color: t.colors.primary };

  return (
    <Card tone="focal">
      <View style={{ gap: t.space[1] }}>
        <AppText style={eyebrowStyle}>{eyebrow}</AppText>
        <AppText style={focalStyle}>{formatClock(focal)}</AppText>
        <AppText variant="caption">{sub}</AppText>
      </View>
    </Card>
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
                  <AppText variant="body" style={{ color: t.colors.ink, fontVariant: ['tabular-nums'] }}>
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
            <AppButton label="Apply" variant="indigo" size="md" onPress={onConfirm} />
            <AppButton label="Keep current" variant="ghost" size="md" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A read-only verdict summary line inside the sheet (no action buttons, neutral). */
function VerdictCardLite({ verdict, deadline }: { verdict: ReprojectDiff['newResult']['verdict']; deadline: number }) {
  const t = useTheme();
  let msg = '';
  if (verdict.kind === 'fits') msg = `Still fits — start by ${formatClock(verdict.startBy)}.`;
  else if (verdict.kind === 'cut-one') msg = `Drop ${verdict.cut.label} to stay on time.`;
  else if (verdict.kind === 'multi-cut') msg = `Drop ${verdict.cuts.map((c) => c.label).join(', ')} to stay on time.`;
  else msg = `About ${verdict.overshootMin}m over — push the finish to ${formatClock(verdict.feasibleDeadline)} or drop a task.`;
  void deadline;
  return (
    <Card
      style={
        verdict.kind === 'fits'
          ? { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary }
          : { backgroundColor: t.colors.surfaceSunken, borderColor: t.colors.border }
      }
    >
      <AppText variant="body" style={{ color: t.colors.ink }}>
        {msg}
      </AppText>
    </Card>
  );
}
