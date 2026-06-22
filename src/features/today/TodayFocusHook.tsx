import { Pressable, View, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from '@/src/components/AppText';
import { formatClockMeridiem } from '@/src/lib/time';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useLearnedFocusWindow } from '@/src/features/planner/useLearnedFocusWindow';
import { useTasksStore } from '@/src/stores/tasksStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// TodayFocusHook — contextual focus-window nudge on the Today screen.
//
// Render gate: only visible when ALL conditions are met:
//   1. basis === 'personal' (engine has learned a real window)
//   2. Current time is before the window's end
//   3. At least 1 active (queued) task exists
//
// Free users: teaser row (no hours shown) → taps to Plan › Focus tab
// Pro users: full window label row → taps to Plan › Focus tab
//
// This is a Pressable row, NOT a filled CTA (the Today screen has its own
// primary CTA; we must not add a competing indigo button here).
// ──────────────────────────────────────────────────────────────────────────────

export interface TodayFocusHookProps {
  nowMs: number;
}

/** Minutes-after-midnight → meridiem clock string (e.g. "9:00am"). */
function clockFor(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return formatClockMeridiem(d.getTime());
}

export function TodayFocusHook({ nowMs }: TodayFocusHookProps): React.ReactElement | null {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);
  const window = useLearnedFocusWindow(nowMs);
  const windowEndMin = useSettingsStore((s) => s.windowEndMin);
  const tasks = useTasksStore((s) => s.tasks);

  const { basis, startMin, endMin } = window;

  // Render gate 1: must have a learned personal window
  if (basis !== 'personal') return null;

  // Render gate 2: must be before the window end
  const now = new Date(nowMs);
  const nowMinuteOfDay = now.getHours() * 60 + now.getMinutes();
  const effectiveEnd = windowEndMin ?? endMin;
  if (nowMinuteOfDay > effectiveEnd) return null;

  // Render gate 3: at least one active (queued) task
  const hasActiveTasks = tasks.filter((task) => task.status === 'queued').length > 0;
  if (!hasActiveTasks) return null;

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

  const leftStyle: ViewStyle = { flex: 1, gap: t.space[0.5] };

  const eyebrowStyle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.primary,
  };

  const labelStyle: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.ink,
  };

  const chevronStyle: TextStyle = {
    fontSize: t.fontSize.lg,
    color: t.colors.inkFaint,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPro && startMin !== null && endMin !== null
        ? `Focus window ${clockFor(startMin)} to ${clockFor(endMin)}`
        : 'Your focus window is ready'}
      onPress={() => router.push('/(tabs)/plan')}
      style={({ pressed }) => [rowStyle, { opacity: pressed ? t.opacity.pressed : 1 }]}
    >
      <View style={leftStyle}>
        {isPro && startMin !== null && endMin !== null ? (
          <>
            <AppText style={eyebrowStyle}>FOCUS WINDOW</AppText>
            <AppText style={labelStyle}>
              {`${clockFor(startMin)}–${clockFor(endMin)}`}
            </AppText>
          </>
        ) : (
          <AppText style={labelStyle}>Your focus window is ready</AppText>
        )}
      </View>
      <AppText style={chevronStyle}>›</AppText>
    </Pressable>
  );
}
