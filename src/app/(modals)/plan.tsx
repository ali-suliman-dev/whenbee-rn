import { useMemo } from 'react';
import { View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
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
import { formatClock, formatClockMeridiem } from '@/src/lib/time';

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
  // the start-by clock (epoch → the user's meridiem format) and to render our
  // own justified start-by/finish-by header line above it.
  const { plan, doneByMin } = useDayPlan();
  const startByClock = plan ? formatClockMeridiem(plan.startBy) : null;

  // Finish-by clock: prefer the user's done-by target (local midnight of the
  // plan's own day + doneByMin) since that's the deadline they're planning
  // against; fall back to the plan's own last placed block when no target is
  // set yet, so the line still reads something real rather than nothing.
  const finishAtMs = useMemo(() => {
    if (!plan) return null;
    if (doneByMin !== null) {
      const localMidnight = new Date(plan.startBy);
      localMidnight.setHours(0, 0, 0, 0);
      return localMidnight.getTime() + doneByMin * 60_000;
    }
    if (plan.timeline.length > 0) {
      return Math.max(...plan.timeline.map((item) => item.endAt));
    }
    return null;
  }, [plan, doneByMin]);

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  // Justified start-by/finish-by line beneath the title.
  const clockRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: t.space[2],
  };
  const startByLineStyle: TextStyle = {
    fontSize: type.body.fontSize,
    color: t.colors.accent,
    fontFamily: t.fontFamily.mono,
  };
  const finishByLineStyle: TextStyle = {
    fontSize: type.body.fontSize,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.mono,
  };

  return (
    // Sheet host already sits below the status bar — no top inset (avoids a gap on
    // Android). Gutters come from the native contentStyle → horizontalPadding={false}.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, floating pinned controls mid-sheet with dead space below. Anchor
          the column to the sheet's 0.95 detent so DayTimeline fills and Done pins. */}
      <View style={{ flex: 1, minHeight: winH * 0.95 - insets.bottom }}>
        <SheetGrabber />

        <View style={{ paddingTop: t.space[2.5], paddingBottom: t.space[3] }}>
          <AppText style={heading}>Today&apos;s plan</AppText>

          {/* Justified start-by/finish-by clocks — the sheet owns this line now;
              DayTimeline's own header is hidden below (hideHeader) to avoid a
              duplicate start-by row. */}
          {plan && startByClock ? (
            <View style={clockRowStyle}>
              <AppText style={startByLineStyle}>Start by {formatClock(plan.startBy)}</AppText>
              {finishAtMs !== null ? (
                <AppText style={finishByLineStyle}>finish by {formatClock(finishAtMs)}</AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* DayTimeline owns the scroll + timeline rows; its own start-by/done-by
            header is hidden here since the sheet renders the clock line above. It
            returns null when the day has no plan or the user isn't Pro. */}
        <View style={{ flex: 1 }}>
          <DayTimeline hideHeader />
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
