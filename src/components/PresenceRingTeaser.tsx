import { useEffect } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// PresenceRingTeaser — locked non-Pro state in Settings → Presence.
//
// Shows a static preview of the Lock Screen presence: a rounded progress BAR
// filling toward a demo finish time, a one-line value statement, and a primary
// CTA. The real Lock Screen surface is a bar (Android ProgressStyle / iOS Live
// Activity), never a ring — so the preview is a bar too.
//
// `onCtaPress` is injected by the parent (usePresenceSection feature hook) so
// this component never imports services directly (ESLint boundary: components
// must not import @/src/services/* or @/src/db/*).
//
// Motion: one-time entrance fill of the bar on mount via Reanimated withTiming,
// using the `honeyFill` duration and `easing.honey` curve. ENTERING-ONLY — never
// sets an `exiting` prop (SIGABRTs on Fabric). Skip under ReduceMotion (renders
// at final state immediately). Shared values accessed only via .get()/.set().
// ──────────────────────────────────────────────────────────────────────────────

// Static demo fill: ~65% — enough to read as "meaningfully progressed" without
// implying a specific task or time. Fixed so the teaser is inert, not user data.
const DEMO_FILL = 0.65;

export function PresenceRingTeaser({ onCtaPress }: { onCtaPress: () => void }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  // 0→DEMO_FILL, one-time on mount. Under ReduceMotion, start at the final state.
  const fillFrac = useSharedValue(reducedMotion ? DEMO_FILL : 0);

  useEffect(() => {
    if (reducedMotion) {
      // Already at final state — nothing to animate.
      return;
    }
    fillFrac.set(
      withTiming(DEMO_FILL, {
        duration: t.motion.honeyFill,
        easing: t.motion.easing.honey,
      }),
    );
    // Runs once on mount; reducedMotion and token values are stable references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillFrac.get() * 100}%`,
  }));

  // ── Layout ────────────────────────────────────────────────────────────────
  const bodyStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const endcapRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: t.space[1.5],
  };

  const nowLabel: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const finishLabel: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  const track: ViewStyle = {
    height: t.space[2.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.ringTrack,
    overflow: 'hidden',
  };

  const fill: ViewStyle = {
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View style={{ paddingTop: t.space[3], gap: t.space[3] }}>
      {/* Value statement */}
      <AppText style={bodyStyle}>
        Your honest finish, live on the Lock Screen while a timer runs.
      </AppText>

      {/* Static bar preview — fills toward a demo finish time, mirroring the
          real Lock Screen surface. */}
      <View accessible={false}>
        <View style={endcapRow}>
          <AppText style={nowLabel}>Now</AppText>
          <AppText style={finishLabel}>7:10</AppText>
        </View>
        <View style={track}>
          <Animated.View style={[fill, fillStyle]} />
        </View>
      </View>

      {/* Primary CTA */}
      <AppButton
        label="Unlock Lock Screen presence"
        onPress={onCtaPress}
        variant="amber"
        fullWidth
      />
    </View>
  );
}
