import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from 'react-native-reanimated';
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
// The Build↔Run transition cross-fades at tokens.motion.base (220ms), ease-out.
// Reduced-motion → instant (FadeIn/FadeOut with ReduceMotion.System).
// ──────────────────────────────────────────────────────────────────────────────

// Shared entering/exiting presets — duration from tokens (base = 220ms, within
// the ≤300ms budget). ReduceMotion.System lets Reanimated honour the OS setting.
const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);
const EXIT = FadeOut.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export default function PlanScreen() {
  const t = useTheme();
  const planner = usePlanner();
  const { phase, clearActive } = planner;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'left', 'right']}>
      {phase === 'run' ? (
        <Animated.View key="run" style={{ flex: 1 }} entering={ENTER} exiting={EXIT}>
          <RunView
            planner={planner}
            abandonSlot={<AbandonButton clearActive={clearActive} />}
          />
        </Animated.View>
      ) : (
        <Animated.View key="build" style={{ flex: 1 }} entering={ENTER} exiting={EXIT}>
          <BuildView planner={planner} />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}
