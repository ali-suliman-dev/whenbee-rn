import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { formatClockMeridiem } from '@/src/lib/time';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// TodayFocusHook — quiet one-line focus-window insight on the Today List.
//
// Render gates:
//   1. basis === 'personal'  — engine has learned a real window
//   2. Current time is before the window end
//
// Gate 3 (queued tasks) is intentionally REMOVED: the insight is useful even
// with an empty list — knowing your sharpest window helps you plan what to add.
// Previously gate 3 required ≥1 queued task; that created a confusing gap where
// calibrated users with a clear day saw nothing. Removed in Phase 5 Task A1.
//
// Pro: "◑ Sharpest {start}–{end} · your window for hard tasks" → Patterns tab
// Free: teaser "Your focus window is ready" + Pro pill → paywall (focus_window)
//        NEVER shows the actual times for free users (position-gated too)
//
// Pressable pattern: bare <Pressable> (no function-form style — reactCompiler
// strips those silently on Fabric). Visual style lives on the inner <View>.
// Pressed feedback via onPressIn/Out + a Reanimated shared value on the inner View.
// ──────────────────────────────────────────────────────────────────────────────

export interface TodayFocusHookProps {
  nowMs: number;
}

/** Minutes-after-midnight → meridiem clock string, e.g. "9:00am". */
function clockFor(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClockMeridiem(d.getTime());
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function TodayFocusHook({ nowMs }: TodayFocusHookProps): React.ReactElement | null {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const window = useLearnedFocusWindow(nowMs);
  const windowEndMin = useSettingsStore((s) => s.windowEndMin);

  const { basis, startMin, endMin } = window;

  // Gate 1: must have a learned personal window
  if (basis !== 'personal') return null;

  // Gate 2: must be before the window end
  const now = new Date(nowMs);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const effectiveEnd = windowEndMin ?? endMin;
  if (nowMinuteOfDay > effectiveEnd) return null;

  // ── pressed feedback (no spring/bounce — settling opacity only) ───────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pressedOpacity = useSharedValue(1);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pressedStyle = useAnimatedStyle(() => ({
    opacity: pressedOpacity.get(),
  }));

  const handlePressIn = () => {
    pressedOpacity.set(withTiming(t.opacity.pressed, { duration: 80 }));
  };
  const handlePressOut = () => {
    pressedOpacity.set(withTiming(1, { duration: 150 }));
  };

  // ── routing ───────────────────────────────────────────────────────────────
  const handlePress = () => {
    if (isPro) {
      router.push('/(tabs)/patterns');
    } else {
      router.push({ pathname: '/(modals)/paywall', params: { trigger: 'focus_window' } });
    }
  };

  // ── a11y label ───────────────────────────────────────────────────────────
  const a11yLabel =
    isPro && startMin !== null && endMin !== null
      ? `Sharpest window ${clockFor(startMin)} to ${clockFor(endMin)} — your window for hard tasks`
      : 'Your focus window is ready — upgrade to Pro to see your sharpest hours';

  // ── styles ────────────────────────────────────────────────────────────────
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    gap: t.space[3],
  };

  const leftStyle: ViewStyle = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[2] };

  const insightStyle: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };

  const chevronStyle: TextStyle = {
    fontSize: t.fontSize.lg,
    color: t.colors.inkFaint,
  };

  // ── Pro pill for free path ────────────────────────────────────────────────
  const pillStyle: ViewStyle = {
    backgroundColor: t.colors.accent,
    paddingHorizontal: t.space[1.5],
    paddingVertical: t.space[0.5],
    borderRadius: t.radii.full,
  };
  const pillTextStyle: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.onAmber,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <AnimatedView style={[rowStyle, pressedStyle]}>
        <View style={leftStyle}>
          {isPro && startMin !== null && endMin !== null ? (
            <AppText style={insightStyle}>
              {`◑ Sharpest ${clockFor(startMin)}–${clockFor(endMin)} · your window for hard tasks`}
            </AppText>
          ) : (
            <>
              <AppText style={insightStyle}>Your focus window is ready</AppText>
              <View style={pillStyle}>
                <Text style={pillTextStyle}>Pro</Text>
              </View>
            </>
          )}
        </View>
        <AppText style={chevronStyle}>›</AppText>
      </AnimatedView>
    </Pressable>
  );
}
