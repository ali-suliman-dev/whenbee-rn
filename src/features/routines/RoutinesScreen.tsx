import { useState } from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { tokens } from '@/src/theme/tokens';
import { ProGate } from '@/src/features/paywall/ProGate';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { RoutinesList } from './RoutinesList';
import { RoutinesLocked } from './RoutinesLocked';
import { RoutineBuildView } from './RoutineBuildView';
import { RoutineRunView } from './RoutineRunView';
import { EXAMPLE_ROUTINE } from './exampleRoutine';

// ──────────────────────────────────────────────────────────────────────────────
// RoutinesScreen — the Routines surface controller (Pro). Owns the internal view:
// list ↔ build/edit ↔ run. A live run (routinesStore.activeRun) always wins so a
// backgrounded run resumes on reopen. Gated content lives behind ProGate; the
// Plan-tab segment that hosts this is always visible (discoverable).
// Entering-only cross-dissolve (no exiting — Fabric SIGABRT).
// ──────────────────────────────────────────────────────────────────────────────

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

type View = { kind: 'list' } | { kind: 'build' };

export function RoutinesScreen() {
  const isPro = useEntitlement((s) => s.isPro);
  const activeRun = useRoutinesStore((s) => s.activeRun);
  const editExisting = useRoutinesStore((s) => s.editExisting);
  const resetDraft = useRoutinesStore((s) => s.resetDraft);
  const [view, setView] = useState<View>({ kind: 'list' });

  // A live run always takes over the surface (resume after backgrounding).
  if (isPro && activeRun !== null) {
    return (
      <Animated.View key="run" style={{ flex: 1 }} entering={ENTER}>
        <RoutineRunView />
      </Animated.View>
    );
  }

  if (isPro && view.kind === 'build') {
    return (
      <Animated.View key="build" style={{ flex: 1 }} entering={ENTER}>
        <RoutineBuildView onDone={() => setView({ kind: 'list' })} />
      </Animated.View>
    );
  }

  const startNew = () => {
    resetDraft();
    setView({ kind: 'build' });
  };
  const openExisting = (id: string) => {
    void editExisting(id);
    setView({ kind: 'build' });
  };
  /** Load the pre-built example into the draft and open the build view.
   *  Nothing is written to the DB — the user can run or tweak before saving. */
  const tryExample = () => {
    resetDraft();
    const store = useRoutinesStore.getState();
    store.setName(EXAMPLE_ROUTINE.name);
    for (const step of EXAMPLE_ROUTINE.steps) {
      store.addStep(step);
    }
    setView({ kind: 'build' });
  };

  return (
    <Animated.View key="list" style={{ flex: 1 }} entering={ENTER}>
      <ProGate fallback={<RoutinesLocked />}>
        <RoutinesList isPro={isPro} onNew={startNew} onOpen={openExisting} onTryExample={tryExample} />
      </ProGate>
    </Animated.View>
  );
}
