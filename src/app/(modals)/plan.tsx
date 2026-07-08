import { View, useWindowDimensions, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { PlanReminderChip } from '@/src/features/today/PlanReminderChip';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { formatClockMeridiem } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// Plan sheet (Option 1) — the day plan the user summoned, fully contained. It
// composes the self-contained DayTimeline (start-by header, timeline rows, done-by
// chip) with the shared PlanReminderChip and a Done affordance. No white native
// header (root `sheet` options), grabber on top, side gutters from the sheet's
// native contentStyle. Dismiss returns to Today.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlanRoute() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // DayTimeline re-reads the plan itself; we read it here only to hand the chip
  // the start-by clock (epoch → the user's meridiem format).
  const { plan } = useDayPlan();
  const startByClock = plan ? formatClockMeridiem(plan.startBy) : null;

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  return (
    // Sheet host already sits below the status bar — no top inset (avoids a gap on
    // Android). Gutters come from the native contentStyle → horizontalPadding={false}.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, floating pinned controls mid-sheet with dead space below. Anchor
          the column to the sheet's 0.95 detent so DayTimeline fills and Done pins. */}
      <View style={{ flex: 1, minHeight: winH * 0.95 - insets.bottom }}>
        <SheetGrabber />

        <View style={{ paddingTop: t.space[2], paddingBottom: t.space[3] }}>
          <AppText style={heading}>Today&apos;s plan</AppText>
        </View>

        {/* DayTimeline owns its own scroll + start-by/done-by header; it returns
            null when the day has no plan or the user isn't Pro. */}
        <View style={{ flex: 1 }}>
          <DayTimeline />
        </View>

        {/* Reminder control + dismiss, pinned above the home indicator. */}
        <View style={{ paddingTop: t.space[3], paddingBottom: insets.bottom + t.space[3], gap: t.space[3] }}>
          <PlanReminderChip startByClock={startByClock} />
          <AppButton label="Done" variant="ghost" fullWidth onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
