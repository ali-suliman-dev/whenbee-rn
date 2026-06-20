// QuickActionArc — three coin-disc bubbles that fan up above the + button.
//
// Entering-only animations (no exiting → Fabric SIGABRT on conditional unmount).
// Bubble order (left→right, a11y reading order): Voice | Timer | Type.
// The center bubble (Timer) is primary-filled and slightly larger.

import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';

// ─── types ────────────────────────────────────────────────────────────────────

export interface QuickActionArcProps {
  /** Center-X of the + button in screen coordinates. */
  anchorX: number;
  /** Center-Y of the + button in screen coordinates. */
  anchorY: number;
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
  { key: 'voice', icon: 'mic',    label: 'Voice',  isCenter: false },
  { key: 'timer', icon: 'play',   label: 'Timer',  isCenter: true  },
  { key: 'type',  icon: 'pencil', label: 'Type',   isCenter: false },
] as const;

// Three angles fanning upward from the anchor. 270° = straight up.
const ARC_ANGLES_DEG: readonly [number, number, number] = [235, 270, 305];

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── component ────────────────────────────────────────────────────────────────

export function QuickActionArc({ anchorX, anchorY, onVoice, onTimer, onType }: QuickActionArcProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { arc } = t.quick;

  const handlers: Record<BubbleDef['key'], () => void> = {
    voice: onVoice,
    timer: onTimer,
    type: onType,
  };

  return (
    <>
      {BUBBLES.map((bubble, i) => {
        const angleDeg = ARC_ANGLES_DEG[i];
        if (angleDeg === undefined) return null;
        const angle = toRad(angleDeg);
        const size = bubble.isCenter ? arc.centerSize : arc.bubbleSize;
        const R = arc.fanRadius;
        const V = arc.verticalOffset;

        // Bubble center in screen coords.
        const cx = anchorX + R * Math.cos(angle);
        const cy = anchorY - V + R * Math.sin(angle);
        const left = cx - size / 2;
        const top = cy - size / 2;

        const delay = reducedMotion ? 0 : i * t.motion.enterStagger;
        const enterAnim = reducedMotion
          ? FadeInUp.duration(t.motion.fast)
          : FadeInUp.duration(t.motion.base)
              .delay(delay)
              .springify()
              .damping(t.motion.spring.damping)
              .stiffness(t.motion.spring.stiffness);

        const isFilled = bubble.isCenter;
        const bgColor = isFilled ? t.colors.primary : t.colors.surface;
        const iconColor = isFilled ? t.colors.onIndigo : t.colors.ink;

        return (
          <Animated.View
            key={bubble.key}
            entering={enterAnim}
            style={{
              position: 'absolute',
              left,
              top,
              width: size,
              height: size,
            }}
          >
            <Pressable
              onPress={handlers[bubble.key]}
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
      })}
    </>
  );
}
