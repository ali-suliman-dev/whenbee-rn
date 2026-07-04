import { useCallback } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useForgotStore } from '@/src/stores/forgotStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import type { AdaptSpeed, LogStatus } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// ForgotCard — recovery card for a session `useForgotCheck` auto-closed while the
// user was away. Offers honest-number-anchored presets so fixing it takes one tap,
// not a form. Confirm writes a completed retro log (trains at half weight via
// `source: 'retro'`); "Still going" reopens the session with no log; dismissing
// writes a partial record that never trains. No guilt anywhere — this reads as
// help, not a correction.
//
// Motion: entrance is opacity-only FadeIn (no slide/bounce, per the animation
// hard rule). Reduced-motion renders the final state directly.
// ──────────────────────────────────────────────────────────────────────────────

export function ForgotCard(): React.JSX.Element | null {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const pending = useForgotStore((s) => s.pending);
  const clear = useForgotStore((s) => s.clear);

  const write = useCallback(
    async (actualMin: number, status: LogStatus) => {
      if (pending === null) return;
      const adaptSpeed: AdaptSpeed =
        useCategoriesStore.getState().categories.find((c) => c.id === pending.category)
          ?.adaptSpeed ?? 'balanced';
      await useCalibrationStore.getState().applyLog({
        category: pending.category,
        estimateMin: pending.guessMin,
        actualMin,
        status,
        source: 'retro',
        adaptSpeed,
        label: pending.taskLabel,
        suggestedHonestMin: pending.honestMin,
        startedAt: null,
      });
      useSettingsStore.getState().markForgotProtectSeen();
      clear();
    },
    [pending, clear],
  );

  const stillGoing = useCallback(() => {
    if (pending === null) return;
    useTimerStore.getState().reopen({
      taskLabel: pending.taskLabel,
      category: pending.category,
      estimateMin: pending.estimateMin,
      startedAt: pending.startedAt,
      guessMin: pending.guessMin,
      taskId: pending.taskId,
      suggestedHonestMin: pending.honestMin,
      isQuickStart: false,
      pausedAccumMs: pending.pausedAccumMs,
    });
    useSettingsStore.getState().markForgotProtectSeen();
    clear();
  }, [pending, clear]);

  if (pending === null) return null;

  const seen = useSettingsStore.getState().forgotProtectSeen;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    borderTopWidth: t.borderWidth.thick,
    borderTopColor: t.colors.accent, // amber, never red
    padding: t.space[5],
    gap: t.space[4],
    margin: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const skip: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(t.motion.base)}
      style={card}
      accessibilityViewIsModal={false}
      accessibilityLiveRegion="polite"
    >
      <AppText style={heading}>{`Wrapped up “${pending.taskLabel}” while you were away`}</AppText>
      <AppText style={body}>
        {seen
          ? 'When did you actually finish?'
          : 'It ran well past your estimate, so I closed it for you. When did you actually finish? You can change when I step in from Settings.'}
      </AppText>
      <View style={{ gap: t.space[2.5] }}>
        <AppButton
          label={`At your honest finish · ${pending.recoveredActualMin}m`}
          variant="amber"
          size="md"
          fullWidth
          onPress={() => void write(pending.recoveredActualMin, 'completed')}
        />
        <AppButton
          label={`At your guess · ${pending.guessMin}m`}
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => void write(pending.guessMin, 'completed')}
        />
        <AppButton
          label="A few minutes ago"
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => void write(Math.max(1, pending.elapsedMin - 5), 'completed')}
        />
        <AppButton label="Still going" variant="ghost" size="md" fullWidth onPress={stillGoing} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not sure yet — skip logging this session"
        onPress={() => void write(pending.recoveredActualMin, 'partial')}
      >
        <AppText style={[skip, { textAlign: 'center' }]}>Not sure yet</AppText>
      </Pressable>
    </Animated.View>
  );
}
