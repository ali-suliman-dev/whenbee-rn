import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  Switch,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { formatClock } from '@/src/lib/time';

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

  // DayTimeline re-reads the plan itself; we read it here only to render the
  // quiet start-by/finish-by summary line in the footer (device clock format, so
  // it matches the timeline rows) and to feed the done-by picker.
  const { plan, doneByMin, setDoneBy } = useDayPlan();
  const startByLabel = plan ? formatClock(plan.startBy) : null;
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
  // other surfaces). The native Switch IS the interactive element (see the
  // controls row below) — no outer Pressable, or a tap would double-toggle.
  const { enabled: nudgeEnabled, toggle: toggleNudge } = useStartByToggle();

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  // Quiet start-by/finish-by summary line — words muted, clocks are the data
  // (start amber = the one time you act on, finish ink = the boundary). Tabular
  // Inter numerals so the two clocks share a baseline with the words.
  const timesLineStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: t.space[1.5],
  };
  const timesWordStyle: TextStyle = {
    fontSize: t.fontSize.caption,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };
  const timesNumStyle: TextStyle = { ...(type.numCaption as unknown as TextStyle) };
  const timesSepStyle: TextStyle = { fontSize: t.fontSize.caption, color: t.colors.inkFaint };

  // Bottom controls — divider, the times line, then one row: a wide neutral
  // Done-by pill (hairline outline — recedes behind the Done CTA) + a plain
  // Settings-style Nudge row (label + native switch), then the CTA.
  const dividerStyle: ViewStyle = {
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
  };
  const controlsRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
  };
  const doneByPillStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2.5],
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.border,
  };
  const doneByLabelStyle: TextStyle = {
    flex: 1,
    fontSize: t.fontSize.caption,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };
  const doneByClockStyle: TextStyle = {
    color: t.colors.ink,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };
  const nudgeRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    flexShrink: 0,
  };
  const nudgeLabelStyle: TextStyle = {
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    color: t.colors.ink,
    fontFamily: t.fontFamily.ui,
  };

  return (
    // Sheet host already sits below the status bar — no top inset (avoids a gap on
    // Android). Gutters come from the native contentStyle → horizontalPadding={false}.
    <Screen edges={['left', 'right']} horizontalPadding={false}>
      {/* react-native-screens' formSheet collapses a flex:1 child to its content
          height, floating pinned controls mid-sheet with dead space below. Anchor
          the column to the sheet's 0.95 detent so DayTimeline fills and Done pins.

          The formSheet is its own native container, separate from the app-root
          GestureHandlerRootView — react-native-reorderable-list's drag pans
          never fire inside it unless this content re-establishes its own
          gesture root (same fix as FinishEditorSheet's Modal). */}
      <GestureHandlerRootView
        testID="plan-gesture-root"
        style={{ flex: 1, minHeight: winH * 0.95 - insets.bottom }}
      >
        <SheetGrabber />

        <View style={{ paddingTop: t.space[5], paddingBottom: t.space[3] }}>
          <AppText style={heading}>Today&apos;s plan</AppText>
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
              paddingBottom: insets.bottom + t.space[5],
              gap: t.space[3],
            },
          ]}
        >
          {/* Quiet start-by · finish summary (device clock format = matches the
              timeline rows). Rendered here, not in the header, so the title reads
              clean. DayTimeline's own header stays hidden (hideHeader). */}
          {plan && startByLabel ? (
            <View style={timesLineStyle} testID="plan-times-line">
              <Text style={timesWordStyle}>Start by</Text>
              <Text style={[timesNumStyle, { color: t.colors.accent }]}>{startByLabel}</Text>
              {finishAtMs !== null ? (
                <>
                  <Text style={timesSepStyle}>·</Text>
                  <Text style={timesWordStyle}>finish</Text>
                  <Text style={[timesNumStyle, { color: t.colors.ink }]}>
                    {formatClock(finishAtMs)}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={controlsRowStyle}>
            <Pressable
              testID="plan-doneby-pill"
              onPress={openDoneByPicker}
              accessibilityRole="button"
              accessibilityLabel={doneByClock ? `Done by ${doneByClock}` : 'Set done-by time'}
              accessibilityHint="Tap to change your done-by target time"
              style={{ flex: 1 }}
            >
              <View style={doneByPillStyle}>
                <Ionicons name="time-outline" size={t.iconSize.sm} color={t.colors.inkFaint} />
                <Text style={doneByLabelStyle} numberOfLines={1}>
                  {doneByClock ? (
                    <>
                      Done by <Text style={doneByClockStyle}>{doneByClock}</Text>
                    </>
                  ) : (
                    'Set done-by'
                  )}
                </Text>
                <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkFaint} />
              </View>
            </Pressable>

            {/* Plain Settings-style row — the native Switch is the sole
                interactive element (a wrapping Pressable would double-toggle). */}
            <View testID="plan-nudge-row" style={nudgeRowStyle}>
              <Ionicons
                name={nudgeEnabled ? 'notifications' : 'notifications-outline'}
                size={t.iconSize.sm}
                color={t.colors.inkSoft}
              />
              <Text style={nudgeLabelStyle}>Nudge</Text>
              <Switch
                testID="plan-nudge-switch"
                value={nudgeEnabled}
                onValueChange={(v) => void toggleNudge(v)}
                trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
                thumbColor={t.colors.surface}
                ios_backgroundColor={t.colors.hairline}
                accessibilityLabel={
                  nudgeEnabled
                    ? `Start nudge on${startByLabel ? `, ${startByLabel}` : ''}. Tap to turn off.`
                    : 'Start nudge off. Tap to turn on.'
                }
              />
            </View>
          </View>

          <AppButton label="Done" variant="indigo" fullWidth onPress={() => router.back()} />
        </View>
      </GestureHandlerRootView>

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
