import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';

/**
 * Three hairline pills, filled indigo up to and including the current step.
 * Forward-only progress indicator for the onboarding flow (no carousel race).
 * On mount the *current* step fills in from the left — a quiet "you advanced"
 * cue; already-completed steps render full instantly so only the new gain moves.
 */
export function StepProgress({ current, total = 3 }: { current: number; total?: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation('onboarding');
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={tr('stepProgress.accessibilityLabel', { current: current + 1, total })}
      style={{ flexDirection: 'row', gap: t.space[1], paddingVertical: t.space[3] }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <Pill key={i} filled={i <= current} active={i === current} />
      ))}
    </View>
  );
}

function Pill({ filled, active }: { filled: boolean; active: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Only the current step animates; completed/empty steps are settled state.
  const grow = useSharedValue(active && !reduced ? 0 : 1);
  useEffect(() => {
    if (!active || reduced) {
      grow.set(1);
      return;
    }
    grow.set(withTiming(1, { duration: t.motion.slow, easing: t.motion.easing.standard }));
  }, [active, reduced, grow, t.motion]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.get() }] }));

  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: t.radii.full,
        backgroundColor: t.colors.hairline,
        overflow: 'hidden',
      }}
    >
      {filled ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: t.radii.full,
              backgroundColor: t.colors.primary,
              transformOrigin: 'left',
            },
            active ? fillStyle : undefined,
          ]}
        />
      ) : null}
    </View>
  );
}
