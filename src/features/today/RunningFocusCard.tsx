import { useCallback, useEffect, useState } from 'react';
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  useReducedMotion,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
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
  const { t: tr } = useTranslation('today');
  const reduced = useReducedMotion();

  const isRunning = useTimerStore((s) => s.isRunning);
  const startedAt = useTimerStore((s) => s.startedAt);
  const taskLabel = useTimerStore((s) => s.taskLabel);
  const category = useTimerStore((s) => s.category);
  const guessMin = useTimerStore((s) => s.guessMin);
  const suggestedHonestMin = useTimerStore((s) => s.suggestedHonestMin);
  const estimateMin = useTimerStore((s) => s.estimateMin);
  const taskId = useTimerStore((s) => s.taskId);
  const isQuickStart = useTimerStore((s) => s.isQuickStart);

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
  useAmbientMotion(
    !reduced,
    useCallback(() => {
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
      return () => {
        cancelAnimation(pulse);
        pulse.set(1);
      };
    }, [pulse, t.motion.pulse, t.opacity.pressed]),
  );
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  if (!isRunning || startedAt === null) return null;

  const honestMin = suggestedHonestMin || estimateMin;
  const categoryLabel = categoryName(category ?? '');

  function reopen() {
    router.push({
      pathname: '/(modals)/timer',
      params: {
        ...(taskId ? { taskId } : null),
        label: taskLabel || tr('runningFocusCard.fallbackLabel'),
        category: category ?? 'getting_ready',
        estimateMin: String(estimateMin),
        guessMin: String(guessMin),
        suggestedHonestMin: String(honestMin),
        // Preserve quick-start flag so useTimer attaches rather than restarting.
        ...(isQuickStart ? { quick: '1' } : null),
      },
    });
  }

  // Mirror FocusCard exactly so the live card swaps in with zero layout jump.
  const eyebrowText: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    fontSize: t.fontSize['2xs'],
    letterSpacing: 1.5,
    // 1.5× the override fontSize — absolute RN lineHeight (tokens.lineHeight are ratios)
    lineHeight: t.fontSize['2xs'] * 1.5,
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
      accessibilityLabel={tr('runningFocusCard.a11y', {
        label: taskLabel ?? tr('runningFocusCard.aTask'),
        elapsed: clockLabel(elapsedSec),
        honestMin,
      })}
      style={pressStyle}
    >
      <Card tone="raised" style={{ gap: t.space[4] }}>
        <View style={topline}>
          <View style={{ flex: 1, gap: t.space[1.5] }}>
            <View style={eyebrowRow}>
              <Animated.View style={[dot, pulseStyle]} />
              <Text style={eyebrow}>{tr('runningFocusCard.eyebrow', { category: categoryLabel.toUpperCase() })}</Text>
            </View>
            <Text style={title} numberOfLines={1}>
              {taskLabel || tr('runningFocusCard.fallbackLabel')}
            </Text>
          </View>
          <View style={rightCol}>
            <Text style={miniHdr}>{tr('runningFocusCard.elapsedHeader')}</Text>
            <Text style={clock}>{clockLabel(elapsedSec)}</Text>
          </View>
        </View>

        <GapLine guessMin={guessMin} honestMin={honestMin} elapsedSec={elapsedSec} />

        <View style={labelsRow}>
          <Text style={guessLabel}>{tr('runningFocusCard.guessed', { count: guessMin })}</Text>
          <Text style={planLabel}>{tr('runningFocusCard.plan', { count: honestMin })}</Text>
        </View>
      </Card>
    </AnimatedPressable>
  );
}
