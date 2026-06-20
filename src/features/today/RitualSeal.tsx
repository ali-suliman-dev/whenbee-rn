// src/features/today/RitualSeal.tsx
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useSharedValue,
  useAnimatedProps,
  useReducedMotion,
  withDelay,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle, G, Defs, ClipPath, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { useAmbientMotion } from '@/src/hooks/useAmbientMotion';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// RitualSeal — the daily "log one honest thing" affordance, drawn as a comb cell
// that seals on a log. Gain-only: the resting outline is a calm invitation (no
// count, no streak, no scold); on a log it plays a one-shot, calm choreography —
// the indigo border draws closed, honey wells up, a soft bloom passes, the ✦
// fades in, and an amber sparkle bursts radially. Resets invisibly each day.
// Border + ✦ are the brand indigo (bee.body); fill is the lit honey yellow.
// ──────────────────────────────────────────────────────────────────────────────

const BOX = 24;
// Flat-top hex path + its approx perimeter (for the border draw).
const HEX = 'M5 12 L8.5 5.4 H15.5 L19 12 L15.5 18.6 H8.5 Z';
const HEX_PERIM = 44;
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export function RitualSeal({
  done,
  onLog,
  size = 27,
}: {
  done: boolean;
  onLog: () => void;
  size?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const m = t.motion.seal;
  const e = t.motion.easing;

  // One shared value per beat (0 → 1), like EnergyGlyph.
  const border = useSharedValue(done ? 1 : 0);
  const honey = useSharedValue(done ? 1 : 0);
  const bloom = useSharedValue(0); // one-shot; rests at 0
  const mark = useSharedValue(done ? 1 : 0);
  const spark = useSharedValue(0); // one-shot; rests at 0
  const restBreath = useSharedValue(0);
  const prevDone = useRef(done);

  useEffect(() => {
    const justSealed = !prevDone.current && done;
    prevDone.current = done;

    if (!done) {
      border.set(0); honey.set(0); mark.set(0); bloom.set(0); spark.set(0);
      return;
    }
    if (reduced || !justSealed) {
      // Already sealed on mount, or reduced motion: snap to final, no motion.
      border.set(1); honey.set(1); mark.set(1); bloom.set(0); spark.set(0);
      restBreath.set(0);
      return;
    }
    // Play the one-shot: border → honey → bloom → ✦ → sparkle.
    restBreath.set(0);
    border.set(0); border.set(withDelay(m.dBorder, withTiming(1, { duration: m.border, easing: e.out })));
    honey.set(0);  honey.set(withDelay(m.dHoney, withTiming(1, { duration: m.honey, easing: e.premium })));
    bloom.set(0);  bloom.set(withDelay(m.dBloom, withTiming(1, { duration: m.bloom, easing: e.calm })));
    mark.set(0);   mark.set(withDelay(m.dMark, withTiming(1, { duration: m.mark, easing: e.out })));
    spark.set(0);  spark.set(withDelay(m.dSpark, withTiming(1, { duration: m.spark, easing: e.out })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, reduced]);

  useAmbientMotion(
    !done && !reduced,
    useCallback(() => {
      restBreath.set(withRepeat(withTiming(1, { duration: t.motion.halo, easing: e.calm }), -1, true));
      return () => {
        cancelAnimation(restBreath);
        restBreath.set(0);
      };
    }, [restBreath, t.motion.halo, e.calm]),
  );

  const borderProps = useAnimatedProps(() => ({ strokeDashoffset: HEX_PERIM * (1 - border.get()) }));
  const honeyProps = useAnimatedProps(() => {
    const h = 14 * honey.get();
    return { height: h, y: 19 - h };
  });
  const surfProps = useAnimatedProps(() => ({ opacity: interpolate(honey.get(), [0, 0.4, 1], [0, 0.8, 0.8]) }));
  const bloomProps = useAnimatedProps(() => ({
    opacity: interpolate(bloom.get(), [0, 0.4, 1], [0, 0.5, 0]),
    r: interpolate(bloom.get(), [0, 1], [11, 13.75]),
  }));
  const markProps = useAnimatedProps(() => ({
    opacity: mark.get(),
    scale: interpolate(mark.get(), [0, 1], [0.85, 1]),
    originX: 12,
    originY: 12,
  }));
  const restProps = useAnimatedProps(() => ({ opacity: interpolate(restBreath.get(), [0, 1], [0.32, 0.46]) }));
  // Each sliver: same shared `spark`, fixed rotation; the inner rect travels out
  // along the rotated axis (y decreasing) while it fades 0→1→0.
  const sparkProps = useAnimatedProps(() => ({
    opacity: interpolate(spark.get(), [0, 0.28, 1], [0, 1, 0]),
    y: interpolate(spark.get(), [0, 1], [9.4, -1.6]),
  }));

  const honeyYellow = t.brand.honeyFill;
  const sealInk = t.brand.bee.body;
  const cream = t.brand.bee.wing;

  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  return (
    <Pressable
      onPress={onLog}
      accessibilityRole="button"
      accessibilityLabel={
        done ? 'Logged one honest thing today.' : 'Log one honest thing today. Skipping is fine.'
      }
    >
      <View style={row}>
        <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
          <Defs>
            <ClipPath id="sealClip"><Path d={HEX} /></ClipPath>
            <RadialGradient id="sealBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={honeyYellow} stopOpacity={0.55} />
              <Stop offset="1" stopColor={honeyYellow} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <AnimatedCircle cx={12} cy={12} animatedProps={bloomProps} fill="url(#sealBloom)" />

          {/* faint resting outline (only meaningful when not sealed) */}
          {!done ? (
            <AnimatedPath d={HEX} fill="none" stroke={t.colors.primary} strokeWidth={1.5} strokeLinejoin="round" animatedProps={restProps} />
          ) : null}

          <Path d={HEX} fill={t.colors.primarySoft} />

          <G clipPath="url(#sealClip)">
            <AnimatedRect x={5} width={14} animatedProps={honeyProps} fill={honeyYellow} />
            <AnimatedRect x={5} y={5.4} width={14} height={1} animatedProps={surfProps} fill={cream} />
          </G>

          <AnimatedPath
            d={HEX}
            strokeDasharray={HEX_PERIM}
            animatedProps={borderProps}
            fill="none"
            stroke={sealInk}
            strokeWidth={1.7}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <AnimatedG animatedProps={markProps}>
            <Path
              d="M12 8.6 C12.3 10.7 13.3 11.7 15.4 12 C13.3 12.3 12.3 13.3 12 15.4 C11.7 13.3 10.7 12.3 8.6 12 C10.7 11.7 11.7 10.7 12 8.6 Z"
              fill={sealInk}
            />
          </AnimatedG>

          {SPARK_ANGLES.map((a) => (
            <G key={a} rotation={a} originX={12} originY={12}>
              <AnimatedRect x={11.65} width={0.7} height={3.2} rx={0.35} animatedProps={sparkProps} fill={honeyYellow} />
            </G>
          ))}
        </Svg>
        <Text style={label}>{done ? "Today's honey set ✦" : 'Log one honest thing'}</Text>
      </View>
    </Pressable>
  );
}
