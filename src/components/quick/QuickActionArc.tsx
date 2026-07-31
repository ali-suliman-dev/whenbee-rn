// QuickActionArc — three coin-disc bubbles that fan up above the + button.
//
// Motion is driven by ONE controlled `progress` shared value (0 = hidden behind
// the +, 1 = fully fanned out) rather than Reanimated layout `entering`/`exiting`
// props — a layout `exiting` on a conditionally-unmounted view SIGABRTs on Fabric.
// The parent keeps this component mounted through the close animation and only
// unmounts after `onClosed` fires (the exit timing callback). This gives us a
// real exit: the bubbles translate + scale back into the + button, then vanish.
//
// Each bubble expands FROM the + button's center (translate from the anchor +
// scale up) so it reads as emerging from behind the button — and reverses the
// same way on close. No spring overshoot → it settles dead still, no wiggle.
//
// Bubble order (left→right, a11y reading order): Timer | Voice | Type.
// The center bubble (Voice) is primary-filled, slightly larger, and leads the
// cascade (last to retract).

import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';

// ─── types ────────────────────────────────────────────────────────────────────

export interface QuickActionArcProps {
  /** Center-X of the + button in screen coordinates. */
  anchorX: number;
  /** Distance from the screen bottom to the + button's center (deterministic — no
   *  measureInWindow, so the fan never drifts after navigating between tabs). */
  anchorBottom: number;
  /** User intent: true plays the expand, false plays the retract. */
  open: boolean;
  /** Fires after the retract finishes so the parent can unmount the overlay. */
  onClosed: () => void;
  onVoice: () => void;
  onTimer: () => void;
  onType: () => void;
}

// ─── bubble definitions ───────────────────────────────────────────────────────

interface BubbleDef {
  key: 'voice' | 'timer' | 'type';
  icon: 'mic' | 'play' | 'pencil';
  label: string;
  isCenter: boolean;
}

const BUBBLES: readonly BubbleDef[] = [
  { key: 'timer', icon: 'play',   label: 'Start timer',  isCenter: false },
  { key: 'voice', icon: 'mic',    label: 'Voice',  isCenter: true  },
  { key: 'type',  icon: 'pencil', label: 'Type',   isCenter: false },
] as const;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── component ────────────────────────────────────────────────────────────────

export function QuickActionArc({
  anchorX,
  anchorBottom,
  open,
  onClosed,
  onVoice,
  onTimer,
  onType,
}: QuickActionArcProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { arc } = t.quick;

  // 0 = tucked behind the +, 1 = fully fanned. One value drives every bubble so
  // the whole fan shares a single timeline and one completion callback.
  const progress = useSharedValue(0);

  // onClosed is often an inline prop — keep it in a ref so the effect depends
  // only on `open` (otherwise it re-fires every render and restarts the timing).
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  const fireClosed = useCallback(() => onClosedRef.current(), []);

  useEffect(() => {
    if (open) {
      // Expand — slow, premium deceleration into a dead-still landing.
      progress.set(
        withTiming(1, { duration: t.motion.arcIn, easing: t.motion.easing.honey }),
      );
      return;
    }
    // Retract — same calm curve in reverse so the bubbles glide back behind the +.
    progress.set(
      withTiming(0, { duration: t.motion.arcOut, easing: t.motion.easing.honey }, (finished) => {
        'worklet';
        if (finished) runOnJS(fireClosed)();
      }),
    );
  }, [open, progress, fireClosed, t.motion.arcIn, t.motion.arcOut, t.motion.easing.honey]);

  const handlers: Record<BubbleDef['key'], () => void> = {
    voice: onVoice,
    timer: onTimer,
    type: onType,
  };

  // Side bubbles fan ±spreadDeg from 270° (straight up).
  const arcAnglesDeg: readonly [number, number, number] = [
    270 - arc.spreadDeg,
    270,
    270 + arc.spreadDeg,
  ];

  return (
    <>
      {BUBBLES.map((bubble, i) => {
        const angleDeg = arcAnglesDeg[i];
        if (angleDeg === undefined) return null;
        return (
          <ArcBubble
            key={bubble.key}
            bubble={bubble}
            angleDeg={angleDeg}
            anchorX={anchorX}
            anchorBottom={anchorBottom}
            progress={progress}
            reducedMotion={reducedMotion}
            onPress={handlers[bubble.key]}
          />
        );
      })}
    </>
  );
}

// ─── single bubble ──────────────────────────────────────────────────────────

interface ArcBubbleProps {
  bubble: BubbleDef;
  angleDeg: number;
  anchorX: number;
  anchorBottom: number;
  progress: ReturnType<typeof useSharedValue<number>>;
  reducedMotion: boolean;
  onPress: () => void;
}

function ArcBubble({
  bubble,
  angleDeg,
  anchorX,
  anchorBottom,
  progress,
  reducedMotion,
  onPress,
}: ArcBubbleProps) {
  const t = useTheme();
  const { arc } = t.quick;

  const angle = toRad(angleDeg);
  const size = bubble.isCenter ? arc.centerSize : arc.bubbleSize;
  const R = arc.fanRadius;
  const V = arc.verticalOffset;

  // Final bubble center (screen coords): X from the left, Y from the bottom.
  const cx = anchorX + R * Math.cos(angle);
  const cyB = anchorBottom + V - R * Math.sin(angle);
  const left = cx - size / 2;
  const bottom = cyB - size / 2;

  // Offset that places the bubble back AT the + center (progress 0). translateY
  // is screen-space (down = +), so tucking toward the lower + means a positive Y.
  const startX = anchorX - cx;
  const startY = cyB - anchorBottom;

  // Center leads the cascade; sides start `leadFrac` later (and retract earlier).
  const lead = bubble.isCenter ? 0 : arc.leadFrac;
  // Spin direction mirrors the fan: the left bubble and center unwind one way,
  // the right bubble the other — so the trio fans open like a hand of cards.
  const startRot = angleDeg > 270 ? arc.spinDeg : -arc.spinDeg;

  const animStyle = useAnimatedStyle(() => {
    const p = interpolate(progress.get(), [lead, 1], [0, 1], Extrapolation.CLAMP);
    if (reducedMotion) {
      return { opacity: p, transform: [] };
    }
    return {
      // Stay opaque almost the whole way: the bubble is OCCLUDED by the + cap as
      // it nears the anchor, so it reads as sliding behind the button — not fading
      // out in mid-air. It only blinks off in the last sliver, already hidden.
      opacity: interpolate(p, [0, 0.12, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(p, [0, 1], [startX, 0], Extrapolation.CLAMP) },
        { translateY: interpolate(p, [0, 1], [startY, 0], Extrapolation.CLAMP) },
        { rotate: `${interpolate(p, [0, 1], [startRot, 0], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(p, [0, 1], [0.5, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const isFilled = bubble.isCenter;
  const bgColor = isFilled ? t.colors.primary : t.colors.surface;
  const iconColor = isFilled ? t.colors.onIndigo : t.colors.ink;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          bottom,
          width: size,
          height: size,
          // Center sits above the sides so the cascade reads as layered.
          zIndex: isFilled ? 2 : 1,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={bubble.label}
        style={{ width: size, height: size }}
      >
        {/* Flat bubble — no coin edge */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: t.radii.full,
            backgroundColor: bgColor,
            borderWidth: isFilled ? 0 : t.borderWidth.chip,
            borderColor: t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={bubble.icon} size={arc.iconSize} color={iconColor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
