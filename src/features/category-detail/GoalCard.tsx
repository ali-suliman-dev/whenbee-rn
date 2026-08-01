import { useEffect, useRef, useState } from 'react';
import { View, Pressable, type ViewStyle, type TextStyle, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Trans, useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { analytics } from '@/src/services/analytics';
import { GOAL_MIN_LOGS, accuracyToErrorBand, logsToGoal } from '@/src/engine';
import type { ContextCorrelation } from '@/src/engine';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useCategoryGoal } from './useCategoryGoal';

// ──────────────────────────────────────────────────────────────────────────────
// GoalCard — the Pro, no-guilt per-category goal COACH (spec 2026-06-26-goal-coach).
//
// States: not-enough / empty / picker (presets + adjustable drag drawer) /
// active (progress + ETA + the biggest-lever coach row) / reached (✦ seal).
// The honey-fill is driven ONLY by the monotonic best, so it never retreats —
// no loss/regression motion anywhere. Amber is the only fill; CTAs are amber
// coin pills (NOT indigo — they never compete with the screen primary). Buttons
// are horizontal pairs, ≤12px text, ~34pt tall (no slabs). Entering-only fades.
// Copy honors the no-guilt ban list (no "failed/behind/streak/missed", no deadline).
// ──────────────────────────────────────────────────────────────────────────────

const EnteringReveal = FadeIn.duration(220);

/** A short, ≤12px coin/ghost button — horizontal pair use only. Pressable stays a
 *  bare touch wrapper; visuals live on the inner View (reactCompiler gotcha). */
function Btn({
  label,
  variant,
  onPress,
  trailingMark,
}: {
  label: string;
  variant: 'coin' | 'ghost';
  onPress: () => void;
  trailingMark?: boolean;
}) {
  const t = useTheme();
  const base: ViewStyle = {
    flex: 1,
    minHeight: t.size.control.xs,
    height: t.size.control.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[1],
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
  };
  const coinWrap: ViewStyle = { flex: 1, paddingBottom: variant === 'coin' ? t.burst.coinEdge : 0 };
  const edgeBase: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: t.burst.coinEdge,
    bottom: 0,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.accentEdge,
  };
  const face: ViewStyle = {
    ...base,
    backgroundColor: t.colors.accent,
  };
  const ghost: ViewStyle = {
    ...base,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
  };
  const coinText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.onAmber,
  };
  const ghostText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  if (variant === 'ghost') {
    return (
      <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
        <View style={ghost}>
          <AppText style={ghostText}>{label}</AppText>
        </View>
      </Pressable>
    );
  }
  return (
    <Pressable style={coinWrap} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={edgeBase} />
      <View style={face}>
        <AppText style={coinText}>{label}</AppText>
        {trailingMark ? <AppText style={coinText}>✦</AppText> : null}
      </View>
    </Pressable>
  );
}

/** The amber honey-fill progress track — grows from 0 to its fraction on focus;
 *  reduced motion paints final. Amber only; physically cannot animate downward. */
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
  const fillBar: ViewStyle = { height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.accent };
  return (
    <View style={track} accessibilityRole="progressbar">
      <Animated.View style={[fillBar, sealed ? { width: '100%' } : fillStyle]} />
    </View>
  );
}

export function GoalCard({
  categoryId,
  categoryName,
  lever,
  ratios,
  currentAccuracy,
}: {
  categoryId: string;
  categoryName: string;
  /** The biggest-lever correlation (or null) from the category detail. */
  lever: ContextCorrelation | null;
  /** Completed clamped ratios oldest→newest — the ETA projection input. */
  ratios: number[];
  /** Current accuracy 0..100 (sharpness) — the ETA projection input. */
  currentAccuracy: number;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');
  const { goal, progress, canSet, presets, recommended, currentBand, justMet, setGoal, keep } =
    useCategoryGoal(categoryId);
  const n = useCalibrationStore((s) => s.statsByCategory[categoryId]?.n ?? 0);

  const [picking, setPicking] = useState(false);
  const [band, setBand] = useState<number>(recommended);

  // Drawer geometry. Left = spot-on (0%), right = ±{currentBand}% now. The marker
  // can land on any integer band from the tightest preset up to one tighter than
  // current — always a real step. Driven by React state (the big number + presets
  // update live); the pan writes state via runOnJS.
  const floorBand = presets.length > 0 ? (presets[presets.length - 1] as number) : 1;
  const ceilBand = Math.max(floorBand, currentBand - 1);
  const trackWidthRef = useRef(0);
  const lastHaptic = useRef(band);

  const clampBand = (v: number) => Math.max(floorBand, Math.min(ceilBand, Math.round(v)));
  const setFromX = (x: number) => {
    const w = trackWidthRef.current;
    if (w <= 0) return;
    const frac = Math.max(0, Math.min(1, x / w));
    const next = clampBand(frac * currentBand);
    if (next !== lastHaptic.current) {
      lastHaptic.current = next;
      haptics.selection();
    }
    setBand(next);
  };
  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = e.nativeEvent.layout.width;
  };
  const pan = Gesture.Pan()
    .onBegin((e) => runOnJS(setFromX)(e.x))
    .onUpdate((e) => runOnJS(setFromX)(e.x));

  // Resolve the analytics state once on mount.
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
    setBand(recommended);
    lastHaptic.current = recommended;
    setPicking(true);
  }
  function openTighterPicker() {
    setBand(presets[0] ?? recommended);
    lastHaptic.current = presets[0] ?? recommended;
    setPicking(true);
  }
  function confirmGoal() {
    setGoal(band);
    setPicking(false);
  }

  const targetBand = goal ? accuracyToErrorBand(goal.targetAccuracy) : 0;
  const bestBand = goal ? accuracyToErrorBand(goal.bestAccuracy) : 0;
  const eta = goal
    ? logsToGoal({ ratios, currentAccuracy, targetAccuracy: goal.targetAccuracy })
    : null;

  const markerFrac = currentBand > 0 ? band / currentBand : 0;

  return (
    <Card>
      {/* ── Header ── */}
      <View style={styles(t).headerRow}>
        <AppText style={styles(t).eyebrow}>
          {goal?.met ? tr('goalCard.eyebrowReached') : tr('goalCard.eyebrow')}
        </AppText>
        {goal ? (
          <View style={styles(t).chip}>
            <AppText style={styles(t).chipText}>{tr('goalCard.withinChip', { band: targetBand })}</AppText>
          </View>
        ) : null}
      </View>

      {/* ── Body by state ── */}
      {!canSet ? (
        // 1 · Not enough
        <View style={styles(t).body}>
          <AppText style={styles(t).headline}>{tr('goalCard.notEnough.headline')}</AppText>
          <AppText style={styles(t).sub}>
            {tr('goalCard.notEnough.sub', { n, min: GOAL_MIN_LOGS })}
          </AppText>
          <View style={styles(t).mutedTrack}>
            <View style={[styles(t).mutedFill, { width: `${Math.min(1, n / GOAL_MIN_LOGS) * 100}%` }]} />
          </View>
        </View>
      ) : picking ? (
        // 3 · Pick — presets + adjustable drawer
        <Animated.View entering={EnteringReveal} style={styles(t).body}>
          <AppText style={styles(t).headline}>{tr('goalCard.picker.headline')}</AppText>
          <AppText style={styles(t).sub}>
            <Trans
              i18nKey="goalCard.picker.sub"
              ns="categoryDetail"
              values={{ band: currentBand }}
              components={{ strong: <AppText style={styles(t).subStrong} /> }}
            />
          </AppText>
          <View style={styles(t).presets}>
            {presets.map((p) => {
              const on = p === band;
              return (
                <Pressable
                  key={p}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setBand(p);
                    lastHaptic.current = p;
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <View style={[styles(t).preset, on && styles(t).presetOn]}>
                    <AppText style={[styles(t).presetVal, on && styles(t).presetValOn]}>{p}%</AppText>
                    <AppText style={[styles(t).presetLbl, on && styles(t).presetValOn]}>{tr('goalCard.picker.presetWithin')}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* drawer */}
          <View style={styles(t).drawer}>
            <View style={styles(t).drLabel}>
              <AppText style={styles(t).drNum}>
                {band}
                <AppText style={styles(t).drNumUnit}>%</AppText>
              </AppText>
              <AppText style={styles(t).drCap}>{tr('goalCard.picker.drawerCaption')}</AppText>
            </View>
            <GestureDetector gesture={pan}>
              <View style={styles(t).dBandHit}>
                <View style={styles(t).dBand} onLayout={onTrackLayout}>
                  <View style={[styles(t).dFill, { width: `${markerFrac * 100}%` }]} />
                  <View style={[styles(t).dThumb, { left: `${markerFrac * 100}%` }]} />
                </View>
              </View>
            </GestureDetector>
            <View style={styles(t).dEnds}>
              <AppText style={styles(t).dEnd}>{tr('goalCard.picker.endSpotOn')}</AppText>
              <AppText style={[styles(t).dEnd, styles(t).dEndNow]}>{tr('goalCard.picker.endNow', { band: currentBand })}</AppText>
            </View>
          </View>

          <View style={styles(t).btnRow}>
            <Btn label={tr('goalCard.picker.notNow')} variant="ghost" onPress={() => setPicking(false)} />
            <Btn label={tr('goalCard.picker.setGoal')} variant="coin" onPress={confirmGoal} />
          </View>
        </Animated.View>
      ) : goal?.met ? (
        // 5 · Reached
        justMet ? (
          <Animated.View entering={EnteringReveal} style={styles(t).body}>
            <View style={styles(t).sealRow}>
              <View style={styles(t).seal}>
                <AppText style={styles(t).sealMark}>✦</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles(t).headline}>{tr('goalCard.reached.headline')}</AppText>
                <AppText style={styles(t).sub}>
                  {tr('goalCard.reached.sub', { categoryName: categoryName.toLowerCase(), band: targetBand })}
                </AppText>
              </View>
            </View>
            <HoneyTrack fraction={1} sealed />
            <View style={styles(t).btnRow}>
              <Btn label={tr('goalCard.reached.keep')} variant="ghost" onPress={keep} />
              <Btn label={tr('goalCard.reached.aimTighter')} variant="coin" trailingMark onPress={openTighterPicker} />
            </View>
          </Animated.View>
        ) : (
          <View style={styles(t).body}>
            <AppText style={styles(t).sub}>{tr('goalCard.reached.subCompact', { band: targetBand })}</AppText>
            <HoneyTrack fraction={1} sealed />
          </View>
        )
      ) : goal ? (
        // 4 · Active — the coach
        <View style={styles(t).body}>
          <AppText style={styles(t).headline}>{tr('goalCard.active.headline')}</AppText>
          <HoneyTrack fraction={progress} />
          <AppText style={styles(t).statLine}>
            <Trans
              i18nKey="goalCard.active.bestSoFar"
              ns="categoryDetail"
              values={{ band: bestBand }}
              components={{ strong: <AppText style={styles(t).statStrong} /> }}
            />
            {eta !== null && eta > 0 ? (
              <AppText style={styles(t).statLine}>
                <Trans
                  i18nKey="goalCard.active.etaTail"
                  ns="categoryDetail"
                  values={{ eta, band: targetBand }}
                  components={{ strong: <AppText style={styles(t).statStrong} /> }}
                />
              </AppText>
            ) : (
              <AppText style={styles(t).statLine}>{tr('goalCard.active.etaFallback')}</AppText>
            )}
          </AppText>
          {lever ? (
            <View style={styles(t).coach}>
              <View style={styles(t).ci}>
                <Ionicons name="bulb-outline" size={t.iconSize.sm} color={t.colors.amberText} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles(t).cl}>{tr('goalCard.active.leverLabel')}</AppText>
                <AppText style={styles(t).ctext}>
                  <Trans
                    i18nKey="goalCard.active.leverText"
                    ns="categoryDetail"
                    values={{ worstValue: lever.worstValue }}
                    components={{ strong: <AppText style={styles(t).ctextK} /> }}
                  />
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        // 2 · Empty (Pro, can set, no goal) — tap to open the picker
        <Pressable onPress={openPicker} accessibilityRole="button" accessibilityLabel={tr('goalCard.empty.accessibilityLabel')}>
          <View style={styles(t).body}>
            <View style={styles(t).titleRow}>
              <AppText style={styles(t).headline}>{tr('goalCard.empty.headline')}</AppText>
              <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
            </View>
            <AppText style={styles(t).sub}>{tr('goalCard.empty.sub', { band: currentBand })}</AppText>
          </View>
        </Pressable>
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
    chip: {
      backgroundColor: t.colors.accentSoft,
      borderRadius: t.radii.full,
      paddingHorizontal: t.space[3],
      paddingVertical: t.space[0.5],
    } as ViewStyle,
    chipText: {
      ...(type.captionBold as unknown as TextStyle),
      color: t.colors.amberText,
    } as TextStyle,
    body: { gap: t.space[3] } as ViewStyle,
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[2] } as ViewStyle,
    headline: { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flexShrink: 1 } as TextStyle,
    sub: { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    subStrong: { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' } as TextStyle,
    mutedTrack: {
      height: t.progress.track,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.surfaceSunken,
      overflow: 'hidden',
    } as ViewStyle,
    mutedFill: { height: '100%', borderRadius: t.radii.full, backgroundColor: t.colors.inkFaint } as ViewStyle,

    // presets
    presets: { flexDirection: 'row', gap: t.space[2] } as ViewStyle,
    preset: {
      minHeight: t.size.control.md,
      borderRadius: t.radii.md,
      borderCurve: 'continuous',
      borderWidth: t.borderWidth.chip,
      borderColor: t.colors.hairline,
      backgroundColor: t.colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: t.space[2],
    } as ViewStyle,
    presetOn: { borderColor: t.colors.accent, backgroundColor: t.colors.accentSoft } as ViewStyle,
    presetVal: {
      fontFamily: 'Inter-Bold',
      fontSize: t.fontSize.caption,
      color: t.colors.ink,
      fontVariant: ['tabular-nums'],
    } as TextStyle,
    presetValOn: { color: t.colors.amberText } as TextStyle,
    presetLbl: {
      ...(type.micro as unknown as TextStyle),
      color: t.colors.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    } as TextStyle,

    // drawer
    drawer: { marginTop: t.space[1], marginBottom: t.space[3] } as ViewStyle,
    drLabel: { flexDirection: 'row', alignItems: 'baseline', gap: t.space[2], marginBottom: t.space[3] } as ViewStyle,
    drNum: {
      fontFamily: 'Inter-Bold',
      fontSize: t.fontSize.lg,
      color: t.brand.honeyFill,
      letterSpacing: -0.5,
      fontVariant: ['tabular-nums'],
    } as TextStyle,
    drNumUnit: { fontSize: t.fontSize.caption, color: t.colors.amberText } as TextStyle,
    drCap: { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    dBandHit: { paddingVertical: t.space[2] } as ViewStyle,
    dBand: {
      position: 'relative',
      height: t.progress.gapTrack,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.surfaceSunken,
    } as ViewStyle,
    dFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.accent,
    } as ViewStyle,
    dThumb: {
      position: 'absolute',
      top: '50%',
      width: t.space[6],
      height: t.space[6],
      marginTop: -t.space[3],
      marginLeft: -t.space[3],
      borderRadius: t.radii.full,
      backgroundColor: t.brand.honeyFill,
      borderWidth: t.borderWidth.thick,
      borderColor: t.colors.accentEdge,
    } as ViewStyle,
    dEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[2.5] } as ViewStyle,
    dEnd: { ...(type.micro as unknown as TextStyle), color: t.colors.inkFaint } as TextStyle,
    dEndNow: { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' } as TextStyle,

    // buttons
    btnRow: { flexDirection: 'row', gap: t.space[2], marginTop: t.space[1] } as ViewStyle,

    // active stat + coach
    statLine: { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft } as TextStyle,
    statStrong: { color: t.colors.ink, fontFamily: 'Inter-Bold', fontVariant: ['tabular-nums'] } as TextStyle,
    coach: {
      flexDirection: 'row',
      gap: t.space[2.5],
      alignItems: 'flex-start',
      marginTop: t.space[1],
      paddingTop: t.space[3],
      borderTopWidth: t.borderWidth.thin,
      borderTopColor: t.colors.hairline,
    } as ViewStyle,
    ci: {
      width: t.space[6],
      height: t.space[6],
      borderRadius: t.radii.sm,
      backgroundColor: t.colors.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    cl: {
      ...(type.micro as unknown as TextStyle),
      color: t.colors.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: t.space[0.5],
    } as TextStyle,
    ctext: { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink } as TextStyle,
    ctextK: { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' } as TextStyle,

    // reached
    sealRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[3] } as ViewStyle,
    seal: {
      width: t.space[8],
      height: t.space[8],
      borderRadius: t.radii.full,
      backgroundColor: t.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    sealMark: { fontFamily: 'Jakarta-Bold', fontSize: t.fontSize.md, color: t.colors.onAmber } as TextStyle,
  };
}
