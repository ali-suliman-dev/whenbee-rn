import { useState } from 'react';
import { View, Pressable, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { formatClock } from '@/src/lib/time';
import { FinishTimeWheel } from '@/src/features/planner/FinishTimeWheel';
import { buildForgotPresets } from '@/src/features/timer/forgotPresets';

// ──────────────────────────────────────────────────────────────────────────────
// ForgotStopSheet — manual "I forgot to stop" recovery on the LIVE timer. Same
// overlay construction as ForgotCard (scrimOverlay dim + surfaceRaised card), but
// driven by props off the running session rather than forgotStore.pending.
//
//  • choices — amber presets ("~5/~15 min ago · Nm"), each stating what it logs,
//    plus a ghost "Pick the exact time". No "About now" (that's just Stop & log).
//  • picker  — FinishTimeWheel; the confirm shows the minutes it will log.
//
// Amber marks the LOG actions (presets + the picker confirm); navigation is ghost.
// Motion: opacity-only FadeIn (animation hard rule); reduced-motion → final state.
// ──────────────────────────────────────────────────────────────────────────────

export interface ForgotStopSheetProps {
  startedAt: number;
  elapsedMin: number;
  honestMin: number;
  onConfirm: (finishMs: number, method: 'preset' | 'wheel') => void;
  onStillGoing: () => void;
  onNotSure: () => void;
}

export function ForgotStopSheet({
  startedAt, elapsedMin, honestMin, onConfirm, onStillGoing, onNotSure,
}: ForgotStopSheetProps): React.JSX.Element {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<'choices' | 'picker'>('choices');
  const [pickedMs, setPickedMs] = useState<number | null>(null);

  const presets = buildForgotPresets(elapsedMin);
  const stepMs = 5 * 60_000;
  const nowMs = Date.now();
  const defaultFinishMs = Math.min(
    nowMs,
    Math.max(startedAt + 60_000, Math.round((startedAt + Math.max(1, honestMin) * 60_000) / stepMs) * stepMs),
  );
  const finishMs = pickedMs ?? defaultFinishMs;
  const clampedFinishMs = Math.min(nowMs, Math.max(startedAt + 60_000, finishMs));
  const pickedActualMin = Math.max(1, Math.round((clampedFinishMs - startedAt) / 60_000));

  const card: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    padding: t.space[5],
    gap: t.space[4],
  };
  const heading: TextStyle = { ...(type.subtitle as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as TextStyle), color: t.colors.inkSoft };
  const skip: TextStyle = { ...(type.caption as TextStyle), color: t.colors.inkFaint };
  const enter = reducedMotion ? undefined : FadeIn.duration(t.motion.base);

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Animated.View entering={enter} style={[StyleSheet.absoluteFillObject, { backgroundColor: t.colors.scrimOverlay }]} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: insets.bottom + t.space[4], paddingHorizontal: t.space[4] }}>
        <Animated.View entering={enter} style={card} accessibilityViewIsModal accessibilityLiveRegion="polite">
          {mode === 'choices' ? (
            <>
              <AppText style={heading}>When did you actually stop?</AppText>
              <AppText style={body}>
                {`The timer kept running past your finish. Pick when you really stopped — I’ll log that, not the full ${Math.floor(elapsedMin)}m.`}
              </AppText>
              <View style={{ gap: t.space[2.5] }}>
                {presets.map((p) => (
                  <AppButton
                    key={p.offsetMin}
                    label={`~${p.offsetMin} min ago  ·  ${p.actualMin}m`}
                    variant="amber"
                    size="md"
                    fullWidth
                    onPress={() => {
                      haptics.selection();
                      onConfirm(startedAt + p.actualMin * 60_000, 'preset');
                    }}
                  />
                ))}
                <AppButton
                  label="Pick the exact time"
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={() => { haptics.light(); setMode('picker'); }}
                />
              </View>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.hairline }} />
              <View style={{ flexDirection: 'row', gap: t.space[2.5] }}>
                <View style={{ flex: 1 }}>
                  <AppButton label="Still going" variant="ghost" size="md" fullWidth onPress={onStillGoing} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Not sure yet — stop without a trained log"
                  onPress={onNotSure}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText style={skip}>Not sure yet</AppText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <AppText style={heading}>When did you finish?</AppText>
              <AppText style={body}>Spin to the time you actually stopped.</AppText>
              <View style={{ paddingVertical: t.space[2] }}>
                <FinishTimeWheel valueMs={clampedFinishMs} mode="be done by" showModes={false} onChange={(ms) => setPickedMs(ms)} />
              </View>
              <AppButton
                label={`Log ${formatClock(clampedFinishMs)}  ·  ${pickedActualMin}m`}
                variant="amber"
                size="md"
                fullWidth
                onPress={() => { haptics.selection(); onConfirm(clampedFinishMs, 'wheel'); }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to the quick options"
                onPress={() => { haptics.light(); setMode('choices'); }}
                style={{ alignItems: 'center', justifyContent: 'center', paddingTop: t.space[1] }}
              >
                <AppText style={skip}>Back</AppText>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
