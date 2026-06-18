import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { tokens } from '@/src/theme/tokens';
import { usePlanner } from '@/src/features/planner/usePlanner';
import { BuildView } from '@/src/features/planner/BuildView';
import { RunView } from '@/src/features/planner/RunView';
import { AbandonButton } from '@/src/features/planner/AbandonButton';

// ──────────────────────────────────────────────────────────────────────────────
// Plan — thin route: renders BuildView or RunView based on planner phase.
//
// No business logic lives here. All state is owned by usePlanner → planStore.
// The Build↔Run transition cross-dissolves: the outgoing view unmounts instantly
// and the incoming one fades in at tokens.motion.base (220ms), ease-out.
//
// Entering-only — NO `exiting` layout animation. On the New Architecture (Fabric)
// a Reanimated exiting animation on a conditionally-unmounted view aborts the app
// during the shadow-tree commit (unmarkNodeAsRemovable → SIGABRT). The whole app
// uses entering-only presets for this reason; the plan screen must not reintroduce
// `exiting`. Reduced-motion → instant (FadeIn with ReduceMotion.System).
// ──────────────────────────────────────────────────────────────────────────────

// Shared entering preset — duration from tokens (base = 220ms, within the ≤300ms
// budget). ReduceMotion.System lets Reanimated honour the OS setting.
const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export default function PlanScreen() {
  const t = useTheme();
  const planner = usePlanner();
  const { phase, clearActive, runGroups } = planner;
  const allDone =
    phase === 'run' &&
    runGroups.done.length > 0 &&
    runGroups.now.length === 0 &&
    runGroups.next.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'left', 'right']}>
      {phase === 'run' ? (
        <Animated.View key="run" style={{ flex: 1 }} entering={ENTER}>
          <RunView
            planner={planner}
            abandonSlot={<AbandonButton clearActive={clearActive} allDone={allDone} />}
          />
        </Animated.View>
      ) : (
        <Animated.View key="build" style={{ flex: 1 }} entering={ENTER}>
          <BuildView planner={planner} />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
