import { useEffect } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';
import { makeBandDomain } from '@/src/features/shared/bandDomain';

interface Props {
  range: HonestRange;
  /** The convergence point (honest minutes) the caret marks. */
  point: number;
  confidence: CalibrationConfidence;
  /** Pro unlocks the precise point tick + caret value; free sees it locked. */
  isPro: boolean;
  /** A prior, wider range to ghost behind the live band (Pro narrowing proof). */
  priorRange?: HonestRange | null;
  /** Tapped when a free user taps the locked caret — opens the paywall. */
  onUnlockPress?: () => void;
}

export function CategoryRangeBand({
  range, point, confidence, isPro, priorRange, onUnlockPress,
}: Props) {
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const { at } = makeBandDomain(range);

  const left = at(range.lowMinutes);
  const width = Math.max(at(range.highMinutes) - left, 0.04);
  const pointPct = at(point);
  const fill = confidence === 'honest' ? t.colors.accent : t.colors.accentSoft;

  // Ghost of the prior, wider range — only when it is genuinely wider (Pro).
  const showGhost =
    isPro && priorRange != null &&
    priorRange.highMinutes - priorRange.lowMinutes > range.highMinutes - range.lowMinutes;
  const ghostLeft = showGhost ? at(priorRange!.lowMinutes) : 0;
  const ghostWidth = showGhost ? Math.max(at(priorRange!.highMinutes) - ghostLeft, 0.04) : 0;

  // Segment narrows inward from the full track on mount (the "tightening" gesture).
  const w = useSharedValue(reduceMotion ? width : 1);
  const l = useSharedValue(left);
  const caretOpacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    const timing = { duration: t.motion.base, easing: t.motion.easing.out, reduceMotion: ReduceMotion.System };
    w.set(withTiming(width, timing));
    l.set(withTiming(left, timing));
    caretOpacity.set(withDelay(t.motion.fast, withTiming(1, { duration: t.motion.fast, reduceMotion: ReduceMotion.System })));
  }, [width, left, t.motion, w, l, caretOpacity]);

  const segStyle = useAnimatedStyle(() => ({ left: `${l.get() * 100}%`, width: `${w.get() * 100}%` }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caretOpacity.get() }));

  const track: ViewStyle = {
    position: 'relative',
    height: t.progress.bandTrack,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    marginTop: t.space[8],
  };
  const segBase: ViewStyle = { position: 'absolute', top: 0, bottom: 0, borderRadius: t.radii.full };
  const ghost: ViewStyle = {
    ...segBase, left: `${ghostLeft * 100}%`, width: `${ghostWidth * 100}%`,
    backgroundColor: t.colors.accentSoft, opacity: 0.5,
  };
  const tick: ViewStyle = {
    position: 'absolute', top: -t.space[0.5], bottom: -t.space[0.5],
    left: `${pointPct * 100}%`, width: t.progress.tickW, marginLeft: -t.progress.tickW / 2,
    borderRadius: t.radii.full, backgroundColor: isPro ? t.colors.accentEdge : t.colors.primary,
  };

  // Caret callout: a small pill + downward triangle, centered on the point.
  // width:0 + alignItems:center centers variable-width children on the point%
  // (RN transforms are numeric, so translateX(-50%) is not an option).
  const calloutWrap: ViewStyle = {
    position: 'absolute', top: -(t.progress.caret.h + t.space[6]),
    left: `${pointPct * 100}%`, width: 0, alignItems: 'center',
  };
  const pill: ViewStyle = {
    backgroundColor: isPro ? t.brand.honeyFill : t.colors.primarySoft,
    borderRadius: t.radii.full, paddingHorizontal: t.space[2], paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: isPro ? t.colors.onAmber : t.colors.primary,
  };
  const caret: ViewStyle = {
    width: 0, height: 0, marginTop: -t.progress.caret.overlap,
    borderLeftWidth: t.progress.caret.w / 2, borderRightWidth: t.progress.caret.w / 2,
    borderTopWidth: t.progress.caret.h, borderStyle: 'solid',
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: isPro ? t.brand.honeyFill : t.colors.primarySoft,
  };
  const endRow: ViewStyle = { position: 'relative', height: t.space[4], marginTop: t.space[2.5] };
  // Same zero-width-centered trick so each end number sits centered on its fill edge.
  const endCell = (frac: number): ViewStyle => ({
    position: 'absolute', left: `${frac * 100}%`, width: 0, alignItems: 'center',
  });
  const endTxt: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  // The caret is the locked-Pro affordance for free users (tap → paywall). Keep
  // the Pressable a bare wrapper; the visual pill sits on the inner View.
  const calloutInner = (
    <View style={{ alignItems: 'center' }}>
      <View style={pill}>
        <Text style={pillText}>{isPro ? `~${point}` : `\u{1F512} ~${point}`}</Text>
      </View>
      <View style={caret} />
    </View>
  );

  return (
    <View>
      <View style={track}>
        {showGhost ? <View style={ghost} pointerEvents="none" /> : null}
        <Animated.View style={[segBase, { backgroundColor: fill }, segStyle]} />
        <View style={tick} pointerEvents="none" />
        <Animated.View style={[calloutWrap, caretStyle]}>
          {isPro || !onUnlockPress ? (
            calloutInner
          ) : (
            <Pressable onPress={onUnlockPress} accessibilityRole="button" accessibilityLabel="Unlock where tasks land with Pro" hitSlop={t.size.hitSlop}>
              {calloutInner}
            </Pressable>
          )}
        </Animated.View>
      </View>
      <View style={endRow}>
        <View style={endCell(left)}><Text style={endTxt}>{range.lowMinutes}</Text></View>
        <View style={endCell(at(range.highMinutes))}><Text style={endTxt}>{range.highMinutes}</Text></View>
      </View>
    </View>
  );
}
