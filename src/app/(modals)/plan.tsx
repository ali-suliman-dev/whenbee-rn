import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppButton } from '@/src/components/AppButton';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';
import { FinishEditorSheet } from '@/src/features/routines/FinishEditorSheet';
import { formatClock, formatClockMeridiem } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// Plan sheet (Option 1) — the day plan the user summoned, fully contained. It
// composes the self-contained DayTimeline (start-by header, timeline rows) with
// a neutral bottom-controls row (done-by time picker + nudge toggle) and a single
// filled Done CTA. No white native header (root `sheet` options), grabber on top,
// side gutters from the sheet's native contentStyle. Dismiss returns to Today.
// ──────────────────────────────────────────────────────────────────────────────

export default function PlanRoute() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // DayTimeline re-reads the plan itself; we read it here only to hand the chip
  // the start-by clock (epoch → the user's meridiem format) and to render our
  // own justified start-by/finish-by header line above it.
  const { plan, doneByMin, setDoneBy } = useDayPlan();
  const startByClock = plan ? formatClockMeridiem(plan.startBy) : null;
  const [doneByPickerOpen, setDoneByPickerOpen] = useState(false);

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

  // Done-by picker — replicates DoneByChip's (DayTimeline.tsx) open/select logic
  // inline: it's a module-private component there, so the neutral pill here opens
  // the same FinishEditorSheet and calls the same setDoneBy from useDayPlan.
  const doneByLocalMidnightMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const doneByClock = useMemo(
    () => (doneByMin === null ? null : formatClock(doneByLocalMidnightMs + doneByMin * 60_000)),
    [doneByMin, doneByLocalMidnightMs],
  );
  const doneByValueMs = doneByMin === null ? null : doneByLocalMidnightMs + doneByMin * 60_000;
  const openDoneByPicker = useCallback(() => setDoneByPickerOpen(true), []);
  const closeDoneByPicker = useCallback(() => setDoneByPickerOpen(false), []);
  const handleDoneByChange = useCallback(
    (ms: number) => setDoneBy(Math.round((ms - doneByLocalMidnightMs) / 60_000)),
    [setDoneBy, doneByLocalMidnightMs],
  );
  const clearDoneBy = useCallback(() => {
    setDoneBy(null);
    setDoneByPickerOpen(false);
  }, [setDoneBy]);

  // Nudge toggle — the shared start-by reminder hook, rendered as a neutral
  // inline pill here (the shared PlanReminderChip component stays untouched for
  // other surfaces).
  const { enabled: nudgeEnabled, toggle: toggleNudge } = useStartByToggle();
  const onToggleNudge = useCallback(() => {
    void toggleNudge(!nudgeEnabled);
  }, [nudgeEnabled, toggleNudge]);

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

  // Bottom controls — divider, then two equal neutral pills, then the CTA.
  const dividerStyle: ViewStyle = {
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
  };
  const controlsRowStyle: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[2],
  };
  const pillStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2.5],
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
  };
  const pillLabelStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.sm,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };
  const toggleTrackStyle: ViewStyle = {
    width: t.space[6],
    height: t.space[4],
    borderRadius: t.radii.full,
    backgroundColor: nudgeEnabled ? t.colors.accent : t.colors.hairline,
    alignItems: nudgeEnabled ? 'flex-end' : 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: t.space[0.5],
  };
  const toggleKnobStyle: ViewStyle = {
    width: t.space[3],
    height: t.space[3],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
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

        {/* Neutral bottom controls + the Done CTA, pinned above the home indicator. */}
        <View
          style={[
            dividerStyle,
            {
              paddingTop: t.space[3],
              paddingBottom: insets.bottom + t.space[3],
              gap: t.space[3],
            },
          ]}
        >
          <View style={controlsRowStyle}>
            <Pressable
              testID="plan-doneby-pill"
              onPress={openDoneByPicker}
              accessibilityRole="button"
              accessibilityLabel={doneByClock ? `Done by ${doneByClock}` : 'Set done-by time'}
              accessibilityHint="Tap to change your done-by target time"
            >
              <View style={pillStyle}>
                <Text style={pillLabelStyle} numberOfLines={1}>
                  {doneByClock ? `Done by ${doneByClock} ›` : 'Set done-by ›'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              testID="plan-nudge-pill"
              onPress={onToggleNudge}
              accessibilityRole="switch"
              accessibilityState={{ checked: nudgeEnabled }}
              accessibilityLabel={
                nudgeEnabled
                  ? `Start nudge on${startByClock ? `, ${startByClock}` : ''}. Tap to turn off.`
                  : 'Start nudge off. Tap to turn on.'
              }
            >
              <View style={pillStyle}>
                <Ionicons
                  name={nudgeEnabled ? 'notifications' : 'notifications-outline'}
                  size={t.iconSize.sm}
                  color={t.colors.inkSoft}
                />
                <Text style={pillLabelStyle}>Nudge</Text>
                <View style={toggleTrackStyle}>
                  <View style={toggleKnobStyle} />
                </View>
              </View>
            </Pressable>
          </View>

          <AppButton label="Done" variant="indigo" fullWidth onPress={() => router.back()} />
        </View>
      </View>

      <FinishEditorSheet
        visible={doneByPickerOpen}
        valueMs={doneByValueMs}
        onChange={handleDoneByChange}
        onClear={clearDoneBy}
        onClose={closeDoneByPicker}
      />
    </Screen>
  );
}
