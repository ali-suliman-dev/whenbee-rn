import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { tokens } from '@/src/theme/tokens';
import { usePlanner } from '@/src/features/planner/usePlanner';
import { BuildView } from '@/src/features/planner/BuildView';
import { RunView } from '@/src/features/planner/RunView';
import { AbandonButton } from '@/src/features/planner/AbandonButton';
import { PlanSegment, type PlanTab } from '@/src/features/routines/PlanSegment';
import { RoutinesScreen } from '@/src/features/routines/RoutinesScreen';

// ──────────────────────────────────────────────────────────────────────────────
// Plan — thin route. A header segmented control switches between:
//   Today    — the existing free Start-By flow (BuildView ↔ RunView). UNCHANGED.
//   Routines — the Pro saved-sequence surface (ProGate'd inside RoutinesScreen).
// The segment is always visible so the Routines value is discoverable; gating is
// the Routines content's job. No business logic lives here.
//
// Entering-only — NO `exiting` layout animation (Fabric SIGABRT on conditionally-
// unmounted views). Reduced-motion → instant (FadeIn with ReduceMotion.System).
// ──────────────────────────────────────────────────────────────────────────────

const ENTER = FadeIn.duration(tokens.motion.base).reduceMotion(ReduceMotion.System);

export default function PlanScreen() {
  const t = useTheme();
  const planner = usePlanner();
  const { phase, clearActive, runGroups } = planner;
  const [tab, setTab] = useState<PlanTab>('today');

  const allDone =
    phase === 'run' &&
    runGroups.done.length > 0 &&
    runGroups.now.length === 0 &&
    runGroups.next.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: t.space[5], paddingTop: t.space[2] }}>
        <PlanSegment value={tab} onChange={setTab} />
      </View>

      {tab === 'routines' ? (
        <Animated.View key="routines" style={{ flex: 1, paddingHorizontal: t.space[5] }} entering={ENTER}>
          <RoutinesScreen />
        </Animated.View>
      ) : phase === 'run' ? (
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
