import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { formatWindowRange } from '@/src/lib/time';
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
// One-line chip, mirroring CapacityChip: ◑ contrast glyph in a 20px indigo disc +
// bodySm + numberOfLines=1. Indigo disc separates Focus (Pro/brand) from the amber
// Honest-day chip.
//
// Pro: "◑ Sharpest {range} · hard tasks" → Patterns tab. {range} via formatWindowRange
//      (respects 12/24h, single collapsed meridiem — e.g. "1:30 – 4:00 pm").
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

const AnimatedView = Animated.createAnimatedComponent(View);

export function TodayFocusHook({ nowMs }: TodayFocusHookProps): React.ReactElement | null {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const window = useLearnedFocusWindow(nowMs);
  const windowEndMin = useSettingsStore((s) => s.windowEndMin);

  // ── pressed feedback (no spring/bounce — settling opacity only) ───────────
  // Hooks must be unconditional — hoisted above all early-return gates.
  const pressedOpacity = useSharedValue(1);
  const pressedStyle = useAnimatedStyle(() => ({
    opacity: pressedOpacity.get(),
  }));

  const { basis, startMin, endMin } = window;

  // Gate 1: must have a revealed personal window
  if (basis !== 'revealed') return null;

  // Gate 2: must be before the window end
  const now = new Date(nowMs);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const effectiveEnd = windowEndMin ?? endMin;
  if (nowMinuteOfDay > effectiveEnd) return null;

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
  const rangeText =
    isPro && startMin !== null && endMin !== null ? formatWindowRange(startMin, endMin) : null;
  const a11yLabel =
    rangeText !== null
      ? `Sharpest ${rangeText} — your window for hard tasks`
      : 'Your focus window is ready — upgrade to Pro to see your sharpest hours';

  // ── styles (mirror CapacityChip: disc + bodySm + one line) ─────────────────
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2.5],
    gap: t.space[2],
  };

  const leftStyle: ViewStyle = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[2] };

  // ◑ contrast glyph in a 20px indigo disc — separates Focus (Pro/brand) from the
  // amber Honest-day chip; replaces the raw "◑" text glyph.
  const discStyle: ViewStyle = {
    width: t.capacity.iconDisc,
    height: t.capacity.iconDisc,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primaryChip,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const insightStyle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };
  const leadStyle: TextStyle = { ...insightStyle, fontFamily: 'Jakarta-Bold', flex: undefined };
  const suffixStyle: TextStyle = { ...insightStyle, color: t.colors.inkSoft, flex: undefined };

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
          <View style={discStyle}>
            <Ionicons name="contrast" size={t.iconSize.xs} color={t.colors.primary} />
          </View>
          {rangeText !== null ? (
            <AppText style={insightStyle} numberOfLines={1}>
              <AppText style={leadStyle}>Sharpest</AppText>
              {` ${rangeText} `}
              <AppText style={suffixStyle}>· hard tasks</AppText>
            </AppText>
          ) : (
            <>
              <AppText style={insightStyle} numberOfLines={1}>
                Your focus window is ready
              </AppText>
              <View style={pillStyle}>
                <Text style={pillTextStyle}>Pro</Text>
              </View>
            </>
          )}
        </View>
        <AppText
          style={chevronStyle}
          importantForAccessibility="no"
          accessibilityElementsHidden
        >
          ›
        </AppText>
      </AnimatedView>
    </Pressable>
  );
}
