import { formatDuration } from '@/src/i18n/formatDuration';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t: tr } = useTranslation('timer');
  const { t: translate } = useTranslation();
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
              <AppText style={heading}>{tr('forgotStop.headingStopped')}</AppText>
              <AppText style={body}>
                {tr('forgotStop.overranBody', {
                  duration: formatDuration(elapsedMin, translate),
                })}
              </AppText>
              <View style={{ gap: t.space[2.5] }}>
                {presets.map((p) => (
                  <AppButton
                    key={p.offsetMin}
                    label={tr('forgotStop.presetOption', {
                      minutes: p.offsetMin,
                      duration: formatDuration(p.actualMin, translate),
                    })}
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
                  label={tr('forgotStop.pickExact')}
                  variant="ghost"
                  size="md"
                  fullWidth
                  onPress={() => { haptics.light(); setMode('picker'); }}
                />
              </View>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.hairline }} />
              <View style={{ flexDirection: 'row', gap: t.space[2.5] }}>
                <View style={{ flex: 1 }}>
                  <AppButton label={tr('forgotStop.stillGoing')} variant="ghost" size="md" fullWidth onPress={onStillGoing} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tr('forgotStop.notSureStopA11y')}
                  onPress={onNotSure}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText style={skip}>{tr('forgotStop.notSure')}</AppText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <AppText style={heading}>{tr('forgotStop.headingFinished')}</AppText>
              <AppText style={body}>{tr('forgotStop.spinBody')}</AppText>
              <View style={{ paddingVertical: t.space[2] }}>
                <FinishTimeWheel
                  valueMs={clampedFinishMs}
                  mode="be done by"
                  showModes={false}
                  minMs={startedAt}
                  maxMs={nowMs}
                  onChange={(ms) => setPickedMs(ms)}
                />
              </View>
              <AppButton
                label={tr('forgotStop.logAt', {
                  clock: formatClock(clampedFinishMs),
                  duration: formatDuration(pickedActualMin, translate),
                })}
                variant="amber"
                size="md"
                fullWidth
                onPress={() => { haptics.selection(); onConfirm(clampedFinishMs, 'wheel'); }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('forgotStop.backA11y')}
                onPress={() => { haptics.light(); setMode('choices'); }}
                style={{ alignItems: 'center', justifyContent: 'center', paddingTop: t.space[1] }}
              >
                <AppText style={skip}>{tr('forgotStop.back')}</AppText>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}
