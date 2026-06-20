import { useEffect, useState } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { GapLine } from './GapLine';
import { useTimerStore } from '@/src/stores/timerStore';

// ──────────────────────────────────────────────────────────────────────────────
// RunningFocusCard — replaces the FocusCard on Today while a session runs, so the
// "next" slot never sits stale beside a live timer. Same skeleton as FocusCard
// (no layout jump on start): the elapsed clock becomes the hero, the gap line
// shows the guess→plan span with a live marker riding it, and the guess/plan
// context stays. The whole card reopens the SAME session (it attaches to the
// running startedAt — finishing lives on the timer screen, not here). Live elapsed
// is wall-clock derived, ticked once a second only while mounted.
// ──────────────────────────────────────────────────────────────────────────────

interface RunningFocusCardProps {
  /** Resolve a category slug → display label (shared with Today). */
  categoryName: (id: string) => string;
}

function clockLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function RunningFocusCard({ categoryName }: RunningFocusCardProps) {
  const t = useTheme();
  const reduced = useReducedMotion();

  const isRunning = useTimerStore((s) => s.isRunning);
  const startedAt = useTimerStore((s) => s.startedAt);
  const taskLabel = useTimerStore((s) => s.taskLabel);
  const category = useTimerStore((s) => s.category);
  const guessMin = useTimerStore((s) => s.guessMin);
  const suggestedHonestMin = useTimerStore((s) => s.suggestedHonestMin);
  const estimateMin = useTimerStore((s) => s.estimateMin);
  const taskId = useTimerStore((s) => s.taskId);

  const [elapsedSec, setElapsedSec] = useState(0);

  // Wall-clock tick (now − startedAt), only while mounted AND running.
  useEffect(() => {
    if (!isRunning || startedAt === null) return;
    const update = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isRunning, startedAt]);

  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  function pressIn() {
    if (!reduced) scale.set(withTiming(0.98, { duration: t.motion.press }));
  }
  function pressOut() {
    if (!reduced) scale.set(withSpring(1, t.motion.spring));
  }

  // The live coin breathes (opacity) — the one moving "alive" signal, not a scold.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(t.opacity.pressed, { duration: t.motion.pulse }),
          withTiming(1, { duration: t.motion.pulse }),
        ),
        -1,
        false,
      ),
    );
  }, [reduced, pulse, t.motion.pulse, t.opacity.pressed]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  if (!isRunning || startedAt === null) return null;

  const honestMin = suggestedHonestMin || estimateMin;
  const categoryLabel = categoryName(category ?? '');

  function reopen() {
    router.push({
      pathname: '/(modals)/timer',
      params: {
        ...(taskId ? { taskId } : null),
        label: taskLabel ?? 'Focus session',
        category: category ?? 'getting_ready',
        estimateMin: String(estimateMin),
        guessMin: String(guessMin),
        suggestedHonestMin: String(honestMin),
      },
    });
  }

  // Mirror FocusCard exactly so the live card swaps in with zero layout jump.
  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    lineHeight: 12,
  };

  const topline: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3] };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = {
    width: t.space[1.5],
    height: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };
  const eyebrow: TextStyle = { ...eyebrowText, color: t.colors.inkSoft };
  const title: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };
  const rightCol: ViewStyle = { alignItems: 'flex-end', gap: t.space[1.5] };
  const miniHdr: TextStyle = { ...eyebrowText, color: t.colors.inkFaint };
  const clock: TextStyle = { ...(type.bigNumber as unknown as TextStyle), color: t.colors.ink };

  const labelsRow: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' };
  // Bold the guess/plan anchors. A named font family (Jakarta-Medium from caption)
  // ignores fontWeight on iOS, so swap the family to the bold cut directly.
  const guessLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontFamily: 'Jakarta-Bold',
    color: t.colors.primary,
  };
  const planLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontFamily: 'Jakarta-Bold',
    color: t.colors.inkSoft,
  };

  return (
    <AnimatedPressable
      onPress={reopen}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`Timing ${taskLabel ?? 'a task'}, ${clockLabel(elapsedSec)} elapsed of about ${honestMin} minutes. Tap to reopen.`}
      style={pressStyle}
    >
      <Card tone="raised" style={{ gap: t.space[4] }}>
        <View style={topline}>
          <View style={{ flex: 1, gap: t.space[1.5] }}>
            <View style={eyebrowRow}>
              <Animated.View style={[dot, pulseStyle]} />
              <Text style={eyebrow}>NOW · {categoryLabel.toUpperCase()}</Text>
            </View>
            <Text style={title} numberOfLines={1}>
              {taskLabel ?? 'Focus session'}
            </Text>
          </View>
          <View style={rightCol}>
            <Text style={miniHdr}>ELAPSED</Text>
            <Text style={clock}>{clockLabel(elapsedSec)}</Text>
          </View>
        </View>

        <GapLine guessMin={guessMin} honestMin={honestMin} elapsedSec={elapsedSec} />

        <View style={labelsRow}>
          <Text style={guessLabel}>guessed {guessMin} min</Text>
          <Text style={planLabel}>plan ~{honestMin} min</Text>
        </View>
      </Card>
    </AnimatedPressable>
  );
}
