import { useCallback, useReducer, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, {
  reorderItems,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatClock } from '@/src/lib/time';
import { CategoryChips, usePickerCategories } from '@/src/features/shared/CategoryChips';
import type { DeadlineMode } from './FinishTimeWheel';
import { FinishTimeWheel } from './FinishTimeWheel';
import { BreatherChips } from './BreatherChips';
import { PlanTaskCard, type PlanTaskCardProps } from './PlanTaskCard';
import { VerdictCard } from './VerdictCard';
import type { usePlanner } from './usePlanner';

// ──────────────────────────────────────────────────────────────────────────────
// BuildView — Phase 1 of the Start-By Plan.
//
// The user works backward from a fixed finish time:
//   1. Set "finish by" time (FinishTimeWheel)
//   2. Choose a breather between tasks (BreatherChips)
//   3. Add / reorder tasks (drag-reorderable list of PlanTaskCards)
//   4. Confirm with "Build my plan" → saveActive → phase flips to 'run'
//
// Verdict:
//   fits → a quiet "start by HH:MM · fits ✓" footer line
//   over → an amber VerdictCard (amber-never-red) with cut/push actions
//
// Inline add composer expands in place — no modal, no route.
// ──────────────────────────────────────────────────────────────────────────────

type PlannerHandle = ReturnType<typeof usePlanner>;

// ── Inline add-task composer ──────────────────────────────────────────────────

interface ComposerState {
  open: boolean;
  title: string;
  category: string | null;
}

type ComposerAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'setTitle'; value: string }
  | { type: 'setCategory'; id: string };

function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'open':
      return { open: true, title: '', category: null };
    case 'close':
      return { open: false, title: '', category: null };
    case 'setTitle':
      return { ...state, title: action.value };
    case 'setCategory':
      return { ...state, category: action.id };
  }
}

function InlineComposer({
  onConfirm,
  onCancel,
}: {
  onConfirm: (label: string, category: string) => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const [state, dispatch] = useReducer(composerReducer, {
    open: false,
    title: '',
    category: null,
  });
  const categories = usePickerCategories();
  const titleRef = useRef<TextInput>(null);

  function handleOpen() {
    dispatch({ type: 'open' });
    // Focus after a brief layout pass.
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function handleConfirm() {
    const label = state.title.trim();
    const category = state.category ?? 'admin';
    if (!label) return;
    onConfirm(label, category);
    dispatch({ type: 'close' });
  }

  function handleCancel() {
    dispatch({ type: 'close' });
    onCancel();
  }

  const addRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.border,
    borderRadius: t.radii.card,
    borderStyle: 'dashed',
    padding: t.space[4],
    marginTop: t.space[2],
  };

  const addLabelStyle: TextStyle = {
    fontSize: t.fontSize.base,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.primary,
  };

  const plusStyle: TextStyle = {
    fontSize: t.fontSize.md,
    color: t.colors.primary,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
  };

  const composerCardStyle: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
    marginTop: t.space[2],
  };

  const inputStyle: TextStyle = {
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.hairline,
    paddingVertical: t.space[2],
  };

  const composerActionsStyle: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[2],
    marginTop: t.space[1],
  };

  if (!state.open) {
    return (
      <Pressable onPress={handleOpen} accessibilityRole="button" accessibilityLabel="Add a task">
        <View style={addRowStyle}>
          <AppText style={plusStyle}>＋</AppText>
          <AppText style={addLabelStyle}>add a task…</AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={composerCardStyle}>
      <TextInput
        ref={titleRef}
        style={inputStyle}
        placeholder="Task name"
        placeholderTextColor={t.colors.inkFaint}
        value={state.title}
        onChangeText={(v) => dispatch({ type: 'setTitle', value: v })}
        onSubmitEditing={handleConfirm}
        returnKeyType="done"
        autoCorrect
        autoCapitalize="sentences"
      />
      <CategoryChips
        categories={categories}
        value={state.category}
        onChange={(id) => dispatch({ type: 'setCategory', id })}
      />
      <View style={composerActionsStyle}>
        <AppButton
          label="Add"
          variant="indigo"
          size="sm"
          disabled={state.title.trim().length === 0}
          onPress={handleConfirm}
        />
        <AppButton label="Cancel" variant="ghost" size="sm" onPress={handleCancel} />
      </View>
    </View>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return (
    <AppText
      style={{
        fontSize: t.fontSize.sm,
        fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
        color: t.colors.inkSoft,
        marginTop: t.space[4],
        marginBottom: t.space[2],
      }}
    >
      {children}
    </AppText>
  );
}

// ── Fits footer ───────────────────────────────────────────────────────────────

function FitsFooter({ startBy }: { startBy: number }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: t.space[3] }}>
      <AppText
        style={{
          fontSize: t.fontSize.xs,
          color: t.colors.inkSoft,
          textAlign: 'center',
        }}
      >
        {'start by '}
        <AppText
          style={{
            fontFamily: t.fontFamily.mono,
            fontSize: t.fontSize.xs,
            color: t.colors.primary,
            fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
          }}
        >
          {formatClock(startBy)}
        </AppText>
        {' · fits ✓'}
      </AppText>
    </View>
  );
}

// ── Over verdict (amber, never red) ──────────────────────────────────────────

function OverVerdict({
  deadline,
  verdict,
  onCut,
  onPush,
}: {
  deadline: number;
  verdict: NonNullable<ReturnType<typeof usePlanner>['result']>['verdict'];
  onCut: (ids: string[]) => void;
  onPush: (ms: number) => void;
}) {
  const t = useTheme();
  // The amber over-verdict card wraps VerdictCard in an amber surface.
  const amberWrap: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderColor: t.colors.accent,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.card,
    overflow: 'hidden',
  };
  return (
    <View style={amberWrap}>
      <VerdictCard
        verdict={verdict}
        deadline={deadline}
        onCut={onCut}
        onPush={onPush}
      />
    </View>
  );
}

// ── BuildView (main) ──────────────────────────────────────────────────────────

export interface BuildViewProps {
  planner: PlannerHandle;
  nowMs?: number;
}

export function BuildView({ planner, nowMs = Date.now() }: BuildViewProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const {
    draft,
    result,
    setDeadline,
    setBreather,
    addTask,
    updateTaskDuration,
    reorderTasks,
    cutTasks,
    pushDeadline,
    saveActive,
    categoryName,
  } = planner;

  // Deadline mode (leave by / be done by / be at)
  const [deadlineMode, setDeadlineMode] = useState<DeadlineMode>('be done by');

  // Local task list — mirrors draft.tasks and is the source for the list.
  // We keep a local copy so the reorderable list can be keyed by ID stably.
  const [localTasks, setLocalTasks] = useState<PlanTaskCardProps[]>(() =>
    draft.tasks.map((task, i) => ({
      variant: 'build' as const,
      id: task.id,
      label: task.label,
      category: categoryName(task.category),
      durationMin: task.durationMin,
      startAt: result?.timeline[i]?.startAt,
      endAt: result?.timeline[i]?.endAt,
    })),
  );

  // Sync local list when draft changes from outside (e.g. addTask / removeTask).
  // This is a one-way sync: local → store only via callbacks.
  const prevDraftLength = useRef(draft.tasks.length);
  if (draft.tasks.length !== prevDraftLength.current) {
    prevDraftLength.current = draft.tasks.length;
    setLocalTasks(
      draft.tasks.map((task, i) => ({
        variant: 'build' as const,
        id: task.id,
        label: task.label,
        category: categoryName(task.category),
        durationMin: task.durationMin,
        startAt: result?.timeline[i]?.startAt,
        endAt: result?.timeline[i]?.endAt,
      })),
    );
  }

  // When the result changes (deadline or breather update), propagate times.
  const prevDeadline = useRef(draft.deadline);
  const prevBreather = useRef(draft.breatherMin);
  if (draft.deadline !== prevDeadline.current || draft.breatherMin !== prevBreather.current) {
    prevDeadline.current = draft.deadline;
    prevBreather.current = draft.breatherMin;
    setLocalTasks((prev) =>
      prev.map((task, i) => ({
        ...task,
        startAt: result?.timeline[i]?.startAt,
        endAt: result?.timeline[i]?.endAt,
      })),
    );
  }

  // ── Reorder ───────────────────────────────────────────────────────────────

  const handleReorder = useCallback(
    (event: ReorderableListReorderEvent) => {
      setLocalTasks((prev) => {
        const next = reorderItems(prev, event.from, event.to);
        reorderTasks(next.map((t) => t.id));
        return next;
      });
    },
    [reorderTasks],
  );

  // ── Add task ──────────────────────────────────────────────────────────────

  const handleAddTask = useCallback(
    (label: string, category: string) => {
      addTask({ label, category });
      // Draft update → useEffect above re-syncs localTasks on next render.
    },
    [addTask],
  );

  // ── Render item ───────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: PlanTaskCardProps }) => (
      <PlanTaskCard
        {...item}
        onDurationChange={(min) => {
          updateTaskDuration(item.id, min);
          setLocalTasks((prev) =>
            prev.map((t) => (t.id === item.id ? { ...t, durationMin: min } : t)),
          );
        }}
      />
    ),
    [updateTaskDuration],
  );

  const keyExtractor = useCallback((item: PlanTaskCardProps) => item.id, []);

  // ── Layout tokens ─────────────────────────────────────────────────────────

  const screenPad: ViewStyle = {
    paddingHorizontal: t.space[4],
  };

  const eyebrowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    marginTop: t.space[2],
  };

  const pipStyle: ViewStyle = {
    width: t.space[2],
    height: t.space[2],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };

  const titleStyle: TextStyle = {
    fontSize: t.fontSize.subtitle,
    fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
    color: t.colors.ink,
    letterSpacing: -0.5,
    marginTop: t.space[1],
  };

  const footerStyle: ViewStyle = {
    paddingHorizontal: t.space[4],
    paddingBottom: Math.max(insets.bottom, t.space[4]),
    gap: t.space[3],
  };

  const hasTasks = localTasks.length > 0;
  const verdict = result?.verdict;
  const startBy = result?.startBy;
  const fits = verdict?.kind === 'fits';

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={screenPad}>
        <View style={eyebrowStyle}>
          <View style={pipStyle} />
          <AppText
            style={{
              fontSize: t.fontSize.sm,
              fontWeight: t.fontWeight.bold as TextStyle['fontWeight'],
              color: t.colors.primary,
            }}
          >
            Start-By Plan
          </AppText>
        </View>
        <AppText style={titleStyle}>Plan backward</AppText>

        {/* ── Finish by ── */}
        <SectionLabel>Finish by</SectionLabel>
        <FinishTimeWheel
          valueMs={draft.deadline}
          mode={deadlineMode}
          onChange={(ms, mode) => {
            setDeadlineMode(mode);
            setDeadline(ms);
          }}
        />

        {/* ── Breather ── */}
        <SectionLabel>Breather between tasks</SectionLabel>
        <BreatherChips value={draft.breatherMin} onChange={setBreather} />

        {/* ── Tasks section label ── */}
        <SectionLabel>Tasks · drag to reorder</SectionLabel>
      </View>

      {/* ── Task list — reorderable ── */}
      {hasTasks ? (
        <View style={{ paddingHorizontal: t.space[4] }}>
          <ReorderableList
            data={localTasks}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onReorder={handleReorder}
            // Disable scroll — we're inside a ScrollView; the list is short.
            scrollEnabled={false}
          />
        </View>
      ) : null}

      {/* ── Inline add composer ── */}
      <View style={{ paddingHorizontal: t.space[4] }}>
        <InlineComposer onConfirm={handleAddTask} onCancel={() => {}} />
      </View>

      {/* ── Spacer to push verdict + CTA to bottom ── */}
      <View style={{ flex: 1 }} />

      {/* ── Verdict / fits line ── */}
      {draft.deadline !== null && verdict !== undefined ? (
        <View style={screenPad}>
          {fits && startBy !== undefined ? (
            <FitsFooter startBy={startBy} />
          ) : !fits ? (
            <OverVerdict
              deadline={draft.deadline}
              verdict={verdict}
              onCut={cutTasks}
              onPush={pushDeadline}
            />
          ) : null}
        </View>
      ) : null}

      {/* ── Footer CTA ── */}
      <View style={footerStyle}>
        <AppButton
          label="Build my plan"
          variant="indigo"
          size="lg"
          fullWidth
          disabled={!hasTasks}
          onPress={() => saveActive(nowMs)}
        />
      </View>
    </ScrollView>
  );
}
