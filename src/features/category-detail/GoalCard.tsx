import { useEffect, useRef, useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { analytics } from '@/src/services/analytics';
import { GOAL_MIN_LOGS, accuracyToErrorBand } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoryGoal } from './useCategoryGoal';

// ──────────────────────────────────────────────────────────────────────────────
// GoalCard — the Pro, no-guilt, loss-proof per-category accuracy goal (spec §5).
//
// Five states: not-enough / empty / picker / active / met (+ collapsed trophy).
// The honey-fill track is driven ONLY by the monotonic best, so it can never
// retreat — there is no loss/regression motion anywhere in this component. Amber
// (honey) is the only fill; the single indigo element is the "Set a goal" / "Set
// goal" CTA. Entering-only animations (Fabric-safe — no exiting layout anim).
//
// Copy is verbatim from spec §10 and honors the no-guilt ban list (no "failed",
// "behind", "streak", "missed", no deadline, no % framed as a deficit).
// ──────────────────────────────────────────────────────────────────────────────

// Picker/celebration reveal: a calm in-place fade at base duration. Entering-only
// (collapse is an unmount with no layout anim → Fabric-safe).
const EnteringReveal = FadeIn.duration(220);

/** Forward-facing headline keyed off progress — direction words, never a bare %. */
function headlineForProgress(p: number): string {
  if (p < 0.34) return 'Just getting going';
  if (p < 0.67) return 'Closing in';
  return 'Almost there';
}

/** The amber honey-fill progress track (View-based, like HonestBand). Grows from 0
 *  to its fraction on mount/focus; reduced motion paints the final width. Amber
 *  only — never indigo, never red, and it physically cannot animate downward. */
function HoneyTrack({ fraction, sealed }: { fraction: number; sealed?: boolean }) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const target = Math.max(0, Math.min(1, fraction));
  const fill = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    fill.set(
      withTiming(target, {
        duration: t.motion.honeyFill,
        easing: t.motion.easing.honey,
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [target, fill, t.motion.honeyFill, t.motion.easing.honey]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  const track: ViewStyle = {
    height: t.progress.track,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const fillBar: ViewStyle = {
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View style={track} accessibilityRole="progressbar">
      <Animated.View style={[fillBar, sealed ? { width: '100%' } : fillStyle]} />
    </View>
  );
}

/** A target / "reached" pill — sibling of the screen's tier pill (amber soft). */
function TargetChip({ band }: { band: number }) {
  const t = useTheme();
  const pill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const text: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };
  return (
    <View style={pill}>
      <AppText style={text}>within {band}%</AppText>
    </View>
  );
}

/** A single-select amber preset chip for the picker. Selected = amber-soft fill +
 *  amber text + amber edge; unselected = plain hairline outline. Amber only — the
 *  indigo Chip selection would collide with the "one indigo per card" rule. */
function PresetChip({
  band,
  selected,
  onPress,
}: {
  band: number;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const chip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2.5],
    minHeight: t.size.control.md,
    borderWidth: t.borderWidth.chip,
    borderColor: selected ? t.colors.accent : t.colors.hairline,
    backgroundColor: selected ? t.colors.accentSoft : t.colors.surfaceRaised,
  };
  const text: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: selected ? t.colors.amberText : t.colors.ink,
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={t.size.hitSlop}
    >
      <View style={chip}>
        <AppText style={text}>within {band}%</AppText>
      </View>
    </Pressable>
  );
}

export function GoalCard({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const t = useTheme();
  const {
    goal,
    progress,
    canSet,
    presets,
    recommended,
    currentBand,
    justMet,
    setGoal,
    keep,
  } = useCategoryGoal(categoryId);

  // The trained log count powers the not-enough "{n} of {min}" copy.
  const n = useCalibrationStore((s) => s.statsByCategory[categoryId]?.n ?? 0);
  const lowerName = categoryName.toLowerCase();

  // Local UI: the picker expands in place (empty → picker, or met → aim-tighter).
  const [picking, setPicking] = useState(false);
  const [selectedBand, setSelectedBand] = useState<number>(recommended);

  // Resolve the analytics state once on mount (the base state; picker is transient).
  const resolvedState: 'empty' | 'active' | 'met' | 'not_enough' = !canSet
    ? 'not_enough'
    : goal?.met
      ? 'met'
      : goal
        ? 'active'
        : 'empty';
  const viewedFired = useRef(false);
  useEffect(() => {
    if (viewedFired.current) return;
    viewedFired.current = true;
    analytics.capture('goal_card_viewed', { category: categoryId, state: resolvedState });
  }, [categoryId, resolvedState]);

  // One calm success haptic the first time the met-celebration shows.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (justMet && !celebratedRef.current) {
      celebratedRef.current = true;
      haptics.success();
    }
  }, [justMet]);

  function openPicker() {
    setSelectedBand(recommended);
    setPicking(true);
  }
  function openTighterPicker() {
    // Aim tighter: presets are already filtered to bands tighter than current.
    setSelectedBand(presets[0] ?? recommended);
    setPicking(true);
  }
  function confirmGoal() {
    setGoal(selectedBand);
    setPicking(false);
  }

  const targetBand = goal ? accuracyToErrorBand(goal.targetAccuracy) : 0;
  const bestSoFarBand = goal ? accuracyToErrorBand(goal.bestAccuracy) : 0;

  return (
    <Card>
      {/* ── Header row: eyebrow + target / reached chip ── */}
      <View style={styles(t).headerRow}>
        <AppText style={styles(t).eyebrow}>{goal?.met ? 'GOAL · REACHED' : 'GOAL'}</AppText>
        {goal ? <TargetChip band={targetBand} /> : null}
      </View>

      {/* ── Body by state ── */}
      {!canSet ? (
        <View style={styles(t).body}>
          <AppText style={styles(t).headline}>A few more logs and you can aim here</AppText>
          <AppText style={styles(t).sub}>
            {n} of {GOAL_MIN_LOGS} logged
          </AppText>
        </View>
      ) : picking ? (
        <Animated.View entering={EnteringReveal} style={styles(t).body}>
          <AppText style={styles(t).headline}>Pick a target</AppText>
          <View style={styles(t).chipRow}>
            {presets.map((band) => (
              <PresetChip
                key={band}
                band={band}
                selected={band === selectedBand}
                onPress={() => setSelectedBand(band)}
              />
            ))}
          </View>
          {selectedBand === recommended ? (
            <AppText style={styles(t).hint}>A real step from where you are.</AppText>
          ) : null}
          <View style={styles(t).actions}>
            <AppButton label="Cancel" variant="ghost" onPress={() => setPicking(false)} />
            <AppButton label="Set goal" variant="indigo" onPress={confirmGoal} />
          </View>
        </Animated.View>
      ) : goal?.met ? (
        justMet ? (
          <Animated.View entering={EnteringReveal} style={styles(t).body}>
            <View style={styles(t).celebrateHead}>
              <Ionicons name="sparkles" size={t.iconSize.md} color={t.colors.accent} />
              <AppText style={styles(t).celebrateTitle}>You did it</AppText>
            </View>
            <AppText style={styles(t).sub}>
              Your {lowerName} estimates landed within {targetBand}%.
            </AppText>
            <HoneyTrack fraction={1} sealed />
            <View style={styles(t).actions}>
              <AppButton label="I'm happy here" variant="ghost" onPress={keep} />
              <AppButton label="Aim tighter" variant="indigo" onPress={openTighterPicker} />
            </View>
          </Animated.View>
        ) : (
          // Collapsed trophy — calm, no prompts (spec §10 "Met, kept").
          <View style={styles(t).body}>
            <AppText style={styles(t).sub}>Reached - within {targetBand}%.</AppText>
            <HoneyTrack fraction={1} sealed />
          </View>
        )
      ) : goal ? (
        // ── Active progress ──
        <View style={styles(t).body}>
          <AppText style={styles(t).headline}>{headlineForProgress(progress)}</AppText>
          <HoneyTrack fraction={progress} />
          <AppText style={styles(t).sub}>Best so far: within {bestSoFarBand}%</AppText>
          <AppText style={styles(t).footer}>Keep logging {lowerName} and it tightens.</AppText>
        </View>
      ) : (
        // ── Empty (can set, no goal yet) ──
        <View style={styles(t).body}>
          <AppText style={styles(t).headline}>Aim for tighter estimates here</AppText>
          <AppText style={styles(t).sub}>You&apos;re within about {currentBand}% right now.</AppText>
          <View style={styles(t).ctaRow}>
            <AppButton label="Set a goal" variant="indigo" fullWidth onPress={openPicker} />
          </View>
        </View>
      )}
    </Card>
  );
}

function styles(t: ReturnType<typeof useTheme>) {
  return {
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: t.space[3],
    } as ViewStyle,
    eyebrow: { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    body: { gap: t.space[3] } as ViewStyle,
    headline: { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink } as TextStyle,
    sub: { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    hint: { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    footer: { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint } as TextStyle,
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] } as ViewStyle,
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: t.space[3] } as ViewStyle,
    ctaRow: { paddingTop: t.space[1] } as ViewStyle,
    celebrateHead: { flexDirection: 'row', alignItems: 'center', gap: t.space[2] } as ViewStyle,
    celebrateTitle: { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink } as TextStyle,
  };
}
