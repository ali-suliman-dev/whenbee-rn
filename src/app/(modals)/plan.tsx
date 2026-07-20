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
import { ConfirmSheet } from '@/src/components/ConfirmSheet';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { DayTimeline } from '@/src/features/today/DayTimeline';
import { useDayPlan } from '@/src/features/today/useDayPlan';
import { useStartByToggle } from '@/src/features/today/useStartByToggle';
import { FinishEditorSheet } from '@/src/features/routines/FinishEditorSheet';
import { PlanAnchorChooser } from '@/src/features/planner/PlanAnchorChooser';
import { formatClock } from '@/src/lib/time';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';

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
  const {
    plan,
    doneByMin,
    setDoneBy,
    startAtMin,
    setStartAt,
    planAnchor,
    setPlanAnchor,
    derivedFinishMs,
    derivedStartByMs,
    effectiveStartMs,
    startHasPassed,
  } = useDayPlan();
  const startByLabel = plan ? formatClock(plan.startBy) : null;
  const [openPicker, setOpenPicker] = useState<'start' | 'finish' | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // The two finish clocks the footer has to tell apart:
  //   target — the done-by the user is planning against (null until they set one)
  //   actual — where the last placed block genuinely lands
  // The gap between them IS the overrun message, so the line reads the real
  // finish and tints it accent; the chooser's finish row still shows the target.
  const { finishAtMs, finishRunsOver } = useMemo(() => {
    if (!plan) return { finishAtMs: null, finishRunsOver: false };
    const localMidnight = new Date(plan.startBy);
    localMidnight.setHours(0, 0, 0, 0);
    const target = doneByMin === null ? null : localMidnight.getTime() + doneByMin * 60_000;
    const actual =
      plan.timeline.length > 0 ? Math.max(...plan.timeline.map((item) => item.endAt)) : null;
    return {
      finishAtMs: actual ?? target,
      finishRunsOver: target !== null && actual !== null && actual > target,
    };
  }, [plan, doneByMin]);

  // Both anchor values are stored as a minute-of-day, so every clock in this
  // sheet converts against the same local midnight.
  const localMidnightMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const toMinuteOfDay = useCallback(
    (ms: number) => Math.round((ms - localMidnightMs) / 60_000),
    [localMidnightMs],
  );
  const doneByMs = doneByMin === null ? null : localMidnightMs + doneByMin * 60_000;
  const startAtMs = startAtMin === null ? null : localMidnightMs + startAtMin * 60_000;

  // One FinishEditorSheet serves both ends — which row opened it decides the
  // title, the value it edits and whether the "Use now" shortcut exists.
  const closePicker = useCallback(() => setOpenPicker(null), []);
  const openStartPicker = useCallback(() => setOpenPicker('start'), []);
  const openFinishPicker = useCallback(() => setOpenPicker('finish'), []);
  const handleStartChange = useCallback(
    (ms: number) => setStartAt(toMinuteOfDay(ms)),
    [setStartAt, toMinuteOfDay],
  );
  const handleDoneByChange = useCallback(
    (ms: number) => setDoneBy(toMinuteOfDay(ms)),
    [setDoneBy, toMinuteOfDay],
  );
  // Hands the start row back to the live "Now" anchor — it re-derives from the
  // clock every render, unlike a pinned minute.
  const useNowStart = useCallback(() => {
    setStartAt(null);
    setOpenPicker(null);
  }, [setStartAt]);
  const clearDoneBy = useCallback(() => {
    setDoneBy(null);
    setOpenPicker(null);
  }, [setDoneBy]);

  // Nudge toggle — the shared start-by reminder hook, rendered as a neutral
  // inline pill here (the shared PlanReminderChip component stays untouched for
  // other surfaces). The native Switch IS the interactive element (see the
  // controls row below) — no outer Pressable, or a tap would double-toggle.
  const { enabled: nudgeEnabled, toggle: toggleNudge } = useStartByToggle();

  // Clear plan — a plan-only reset (start time, finish, nudge, hand-sorted
  // order). The queued tasks themselves are untouched; see clearPlan in
  // dayTasksStore. Confirmed via the app's styled ConfirmSheet (never a native
  // Alert) so a reset feels considered and on-theme, matching Settings.
  const handleClearConfirm = useCallback(() => {
    setClearConfirmOpen(false);
    void (async () => {
      await useDayTasksStore.getState().clearPlan();
      await toggleNudge(false);
      router.back();
    })();
  }, [toggleNudge]);

  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const clearButtonStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
  };
  const clearLabelStyle: TextStyle = {
    fontFamily: t.fontFamily.ui,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    fontSize: t.fontSize.bodySm,
    color: t.colors.danger, // audit-ok: destructive — the Clear-plan reset action
  };

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

  // Bottom controls — divider, the times line, then two stacked full-width
  // Settings-style cells (hairline outline, so they recede behind the Done CTA):
  // a Done-by picker cell + a Nudge toggle cell, then the CTA. Stacked (not
  // side-by-side) so each stays a legible, comfortably-tall tap target on Android
  // — the earlier one-row layout collapsed the Done-by cell's height there.
  const dividerStyle: ViewStyle = {
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
  };
  const controlsColStyle: ViewStyle = {
    gap: t.space[2.5],
  };
  const cellStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2.5],
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2.5],
    minHeight: t.size.control.md,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaised,
  };
  const cellLabelStyle: TextStyle = {
    flex: 1,
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

        <View style={[headerRow, { paddingTop: t.space[5], paddingBottom: t.space[3] }]}>
          <AppText style={heading}>Today&apos;s plan</AppText>
          {plan != null ? (
            <Pressable
              testID="plan-clear-button"
              onPress={() => setClearConfirmOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Clear plan"
              hitSlop={t.size.hitSlop}
            >
              <View style={clearButtonStyle}>
                <Ionicons
                  name="refresh-outline"
                  size={t.iconSize.sm}
                  color={t.colors.danger} // audit-ok: destructive — the Clear-plan reset action
                />
                <Text style={clearLabelStyle}>Clear</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* DayTimeline owns the scroll + timeline rows; its own start-by/done-by
            header is hidden here since the sheet renders the clock line above. It
            returns null when the day has no plan or the user isn't Pro. */}
        <View style={{ flex: 1, marginTop: t.space[3] }}>
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
              <Text style={[timesNumStyle, { color: t.colors.ink }]}>{startByLabel}</Text>
              {finishAtMs !== null ? (
                <>
                  <Text style={timesSepStyle}>·</Text>
                  <Text style={timesWordStyle}>finish</Text>
                  {/* Accent when the day genuinely runs past the done-by target —
                      the gap between this clock and the target IS the message.
                      Amber, never red: the day ran long, nobody failed. */}
                  <Text
                    testID="plan-finish-clock"
                    style={[
                      timesNumStyle,
                      { color: finishRunsOver ? t.colors.accent : t.colors.ink },
                    ]}
                  >
                    {formatClock(finishAtMs)}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          <View style={controlsColStyle}>
            {/* Which end of the day is fixed. Replaces the old standalone Done-by
                cell — a finish time is now one of the two answers, not a setting
                that sits on its own. */}
            <PlanAnchorChooser
              selected={planAnchor}
              startAtMs={startAtMs}
              derivedFinishMs={derivedFinishMs}
              finishByMs={doneByMs}
              derivedStartByMs={derivedStartByMs}
              effectiveStartMs={effectiveStartMs}
              startHasPassed={startHasPassed}
              onSelect={setPlanAnchor}
              onEditStart={openStartPicker}
              onEditFinish={openFinishPicker}
            />

            {/* Plain Settings-style cell — the native Switch is the sole
                interactive element (a wrapping Pressable would double-toggle) and
                keeps its stock platform appearance on iOS + Android. */}
            <View testID="plan-nudge-row" style={cellStyle}>
              <Ionicons
                name={nudgeEnabled ? 'notifications' : 'notifications-outline'}
                size={t.iconSize.md}
                color={t.colors.inkSoft}
              />
              <Text style={cellLabelStyle}>Nudge me to start</Text>
              <Switch
                testID="plan-nudge-switch"
                value={nudgeEnabled}
                onValueChange={(v) => void toggleNudge(v)}
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

      {/* The start picker. `Use now` is start-only — "finish by now" is
          meaningless — and Clear is a no-op here since Now IS the empty state. */}
      <FinishEditorSheet
        visible={openPicker === 'start'}
        title="Start at"
        valueMs={startAtMs}
        onChange={handleStartChange}
        onClear={useNowStart}
        onUseNow={useNowStart}
        onClose={closePicker}
      />

      <FinishEditorSheet
        visible={openPicker === 'finish'}
        title="Finish by"
        valueMs={doneByMs}
        onChange={handleDoneByChange}
        onClear={clearDoneBy}
        onClose={closePicker}
      />

      <ConfirmSheet
        visible={clearConfirmOpen}
        tone="danger"
        glyphKind="progress"
        title="Clear today's plan?"
        bullets={[
          'Removes your start time, finish and nudge',
          'Clears any hand-sorted order',
          'Your tasks stay in the queue',
        ]}
        confirmLabel="Clear plan"
        onConfirm={handleClearConfirm}
        onCancel={() => setClearConfirmOpen(false)}
      />
    </Screen>
  );
}
