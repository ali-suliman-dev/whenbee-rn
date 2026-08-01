import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { RIPENING_COPY } from './copy';

// ──────────────────────────────────────────────────────────────────────────────
// RipeningBand — settling ↔ sharp honest-range band.
//
// Settling state (!revealed):
//   A sunken well holds a low-opacity ghost segment and a centered "Still
//   settling…" label. Pure display — no native blur, no interactivity.
//
// Sharp state (revealed):
//   The well switches to a primaryWash tint. A primarySoft range segment
//   fills the centre (left 30 %–right 30 %), an indigo dot with a white ring
//   sits at the midpoint, and lowLabel/highLabel ticks appear above the ends.
//
// Transition (settling → sharp):
//   The segment width eases from 0 → full via withTiming(honeyFill, honey
//   easing). The dot fades 0 → 1 on the same curve. Under useReducedMotion()
//   the final values are set instantly with no animation.
//
// Motion rationale (motion-design skill):
//   Emotional target = calm clarity (data has arrived, here's the truth).
//   Motion personality = Premium: long, decelerating, no overshoot.
//   Primary properties = width (segment grow) + opacity (dot materialize).
//   Token durations + curves come from t.motion.honeyFill + t.motion.easing.honey.
//   Entering-only — NO `exiting` layout animations (Fabric SIGABRT on Reanimated).
// ──────────────────────────────────────────────────────────────────────────────

// Dot geometry: diameter + ring width live as named constants so they are
// token-adjacent but don't need a full token entry (purely local geometry).
const DOT_SIZE = 10;
const RING_WIDTH = 2;

interface RipeningBandProps {
  revealed: boolean;
  lowLabel?: string;
  highLabel?: string;
}

export function RipeningBand({ revealed, lowLabel, highLabel }: RipeningBandProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const reducedMotion = useReducedMotion();

  // ── shared values ────────────────────────────────────────────────────────
  // segmentProgress: 0 = zero-width (settling ghost), 1 = full (sharp range).
  // dotOpacity:      0 = invisible, 1 = fully visible.
  const segmentProgress = useSharedValue(revealed ? 1 : 0);
  const dotOpacity = useSharedValue(revealed ? 1 : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    if (reducedMotion) {
      // Reduced-motion: skip animation, apply final state instantly.
      segmentProgress.set(target);
      dotOpacity.set(target);
    } else if (revealed) {
      // Animate ONLY on entering the revealed state (no exiting animation).
      const cfg = {
        duration: t.motion.honeyFill,
        easing: t.motion.easing.honey,
      };
      segmentProgress.set(withTiming(1, cfg));
      dotOpacity.set(withTiming(1, cfg));
    } else {
      // Snapping back to settling: instant (no exit animation per ENTERING-ONLY rule).
      segmentProgress.set(0);
      dotOpacity.set(0);
    }
  }, [revealed, reducedMotion, segmentProgress, dotOpacity, t.motion.honeyFill, t.motion.easing.honey]);

  // ── animated styles ───────────────────────────────────────────────────────
  // The segment is absolutely positioned; we animate its width as a percentage
  // of the parent by interpolating 0 → 40 (the sharp centre occupies 40% of the
  // track: left 30%, right 30%, so segment = 40% wide centred).
  const segmentStyle = useAnimatedStyle(() => ({
    width: `${segmentProgress.get() * 40}%` as `${number}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.get(),
  }));

  // ── layout styles (all values from tokens) ───────────────────────────────
  const track: ViewStyle = {
    height: t.progress.gapTrack,
    borderRadius: t.radii.full,
    backgroundColor: revealed ? t.colors.primaryWash : t.colors.surfaceSunken,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Ghost segment (settling state only): fixed geometry matching HonestBandLockedTeaser.
  const ghost: ViewStyle = {
    position: 'absolute',
    left: '32%',
    width: '36%',
    top: 0,
    bottom: 0,
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.full,
    opacity: 0.55, // Mirrors HonestBandLockedTeaser ghost opacity
  };

  // Sharp range segment: animated width centred in the track.
  const sharpSegmentBase: ViewStyle = {
    position: 'absolute',
    left: '30%',
    top: 0,
    bottom: 0,
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radii.full,
    // width is supplied by the animated style
  };

  // Indigo dot with ring (surface-colored), centred on the track.
  const dotOuter: ViewStyle = {
    position: 'absolute',
    width: DOT_SIZE + RING_WIDTH * 2,
    height: DOT_SIZE + RING_WIDTH * 2,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const dotInner: ViewStyle = {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };

  // Tick label above the left end (30% from left).
  const tickLeft: ViewStyle = {
    position: 'absolute',
    left: '30%',
    bottom: t.progress.gapTrack + t.space[1],
    transform: [{ translateX: -(t.space[4]) }],
  };

  // Tick label above the right end (30% from right = 70% from left).
  const tickRight: ViewStyle = {
    position: 'absolute',
    right: '30%',
    bottom: t.progress.gapTrack + t.space[1],
    transform: [{ translateX: t.space[4] }],
  };

  const tickText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.primary,
  };

  const settlingText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };

  const wrapper: ViewStyle = {
    gap: t.space[1],
  };

  // Ticks container (overlaps the track) — wraps track + labels in a relative
  // positioned box so absolute tick positions are relative to the track width.
  const trackWrapper: ViewStyle = {
    position: 'relative',
  };

  return (
    <View style={wrapper}>
      {/* ── ticks row (sharp state only) ──────────────────────────────────── */}
      {revealed && (lowLabel != null || highLabel != null) ? (
        <View style={{ position: 'relative', height: t.space[4] }}>
          {lowLabel != null ? (
            <View style={tickLeft}>
              <AppText style={tickText}>{lowLabel}</AppText>
            </View>
          ) : null}
          {highLabel != null ? (
            <View style={tickRight}>
              <AppText style={tickText}>{highLabel}</AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── track ─────────────────────────────────────────────────────────── */}
      <View style={trackWrapper}>
        <View style={track}>
          {!revealed ? (
            /* Settling ghost: fixed geometry, lower opacity */
            <View style={ghost} pointerEvents="none" />
          ) : (
            /* Sharp range: animated width + centred dot */
            <>
              <Animated.View style={[sharpSegmentBase, segmentStyle]} pointerEvents="none" />
              <Animated.View style={[dotOuter, dotStyle]} pointerEvents="none">
                <View style={dotInner} />
              </Animated.View>
            </>
          )}
        </View>
      </View>

      {/* ── settling label ────────────────────────────────────────────────── */}
      {!revealed ? (
        <AppText style={settlingText}>{RIPENING_COPY(tr).settling}</AppText>
      ) : null}
    </View>
  );
}
