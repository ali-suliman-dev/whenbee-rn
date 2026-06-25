import { useCallback, useEffect, useState } from 'react';
import { Alert, View, Switch, Pressable, ActivityIndicator, type TextStyle, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { getCalendar } from '@/src/services/calendar';
import { disableExport } from '@/src/services/calendarExport';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarSettingsSection — "Calendar" group in Settings.
//
// Master toggle (showEvents) + per-calendar checkboxes. Read-only access only —
// events surface on the day view so Whenbee can count your real commitments. No
// calendar data is written here; the Honest-Day confirm is the only write path.
//
// Access-request flow:
//   1. User flips the master toggle ON.
//   2. We ask the OS for read access (requestReadAccess).
//   3a. Granted → persist showEvents:true, load the calendar list.
//   3b. Denied  → flip the toggle back + show a calm hint to check iOS Settings.
//
// Per-calendar logic:
//   enabledCalendarIds = [] means all calendars are visible (the opt-out default).
//   Tapping a calendar row runs toggleCalendar(id), which adds the id if missing
//   (opt-in that calendar to the explicit list) or removes it (returning it to the
//   implicit "all enabled" set).
// ──────────────────────────────────────────────────────────────────────────────

interface CalendarRow {
  id: string;
  title: string;
}

export function CalendarSettingsSection() {
  const t = useTheme();

  const showEvents = useSettingsStore((s) => s.calendar.showEvents);
  const enabledCalendarIds = useSettingsStore((s) => s.calendar.enabledCalendarIds);
  const exportEnabled = useSettingsStore((s) => s.calendar.exportEnabled);
  const whenbeeCalendarId = useSettingsStore((s) => s.calendar.whenbeeCalendarId);
  const setShowEvents = useSettingsStore((s) => s.setShowEvents);
  const toggleCalendar = useSettingsStore((s) => s.toggleCalendar);
  const setExportEnabled = useSettingsStore((s) => s.setExportEnabled);
  const setWhenbeeCalendarId = useSettingsStore((s) => s.setWhenbeeCalendarId);

  const isPro = useEntitlement((s) => s.isPro);

  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [exportWriteDenied, setExportWriteDenied] = useState(false);

  // Load the calendar list whenever the master toggle is on.
  useEffect(() => {
    if (!showEvents) {
      setCalendars([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCalendar()
      .listCalendars()
      .then((list) => {
        if (!cancelled) setCalendars(list);
      })
      .catch(() => {
        if (!cancelled) setCalendars([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showEvents]);

  const handleMasterToggle = useCallback(
    async (next: boolean) => {
      setAccessDenied(false);
      if (!next) {
        setShowEvents(false);
        return;
      }
      // Turning on — request read access first.
      const granted = await getCalendar().requestReadAccess();
      if (granted) {
        setShowEvents(true);
      } else {
        // Stay off; show a calm hint.
        setAccessDenied(true);
      }
    },
    [setShowEvents],
  );

  const handleExportToggle = useCallback(
    async (next: boolean) => {
      setExportWriteDenied(false);

      if (!next) {
        // Turning OFF — confirm, then delete all Whenbee events and clear db links.
        Alert.alert(
          'Remove plan from calendar?',
          "This removes all events Whenbee added to its own calendar. Your other calendars aren't touched.",
          [
            {
              text: 'Keep events',
              style: 'cancel',
            },
            {
              text: 'Remove and turn off',
              style: 'destructive',
              onPress: async () => {
                if (whenbeeCalendarId !== null) {
                  await disableExport(whenbeeCalendarId);
                  // §8.2: also remove the empty Whenbee calendar itself so it
                  // doesn't linger in the user's calendar list.
                  await getCalendar().deleteWhenbeeCalendar(whenbeeCalendarId);
                }
                // Clear stale task→event db links so the next export starts clean.
                await useDayTasksStore.getState().clearAllCalendarLinks();
                setExportEnabled(false);
                setWhenbeeCalendarId(null);
              },
            },
          ],
        );
        return;
      }

      // Turning ON — request write access, ensure the Whenbee calendar exists.
      const granted = await getCalendar().requestWriteAccess();
      if (!granted) {
        setExportWriteDenied(true);
        return;
      }

      const calId = await getCalendar().ensureWhenbeeCalendar(whenbeeCalendarId);
      setWhenbeeCalendarId(calId);
      setExportEnabled(true);
    },
    [whenbeeCalendarId, setExportEnabled, setWhenbeeCalendarId],
  );

  function openExportPaywall() {
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'calendar_export' } });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: t.size.control.lg,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };

  const divider: ViewStyle = {
    height: 1,
    backgroundColor: t.colors.hairline,
    marginLeft: t.space[4] + t.iconSize.md + t.space[3],
  };

  const titleStyle: TextStyle = {
    ...(type.bodySmBold as unknown as TextStyle),
    color: t.colors.ink,
  };

  const noteStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const hintStyle: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[3],
  };

  return (
    <View style={{ gap: t.space[3] }}>
      <AppText variant="label">Calendar</AppText>

      <View style={card}>
        {/* Master toggle row */}
        <View style={row}>
          <Ionicons
            name="calendar-outline"
            size={t.iconSize.md}
            color={t.colors.inkSoft}
          />
          <View style={{ flex: 1, gap: t.space[0.5] }}>
            <AppText style={titleStyle}>Show calendar events</AppText>
            <AppText style={noteStyle}>
              Events appear read-only and count toward your honest-day capacity.
            </AppText>
          </View>
          <Switch
            value={showEvents}
            onValueChange={handleMasterToggle}
            trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
            accessibilityLabel="Show calendar events"
          />
        </View>

        {/* Access-denied hint */}
        {accessDenied ? (
          <AppText style={hintStyle}>
            Calendar access is off. Open iOS Settings → Whenbee → Calendar to allow it.
          </AppText>
        ) : null}

        {/* Per-calendar list */}
        {showEvents && !loading && calendars.length > 0 ? (
          <>
            <View style={divider} />
            {calendars.map((cal, idx) => {
              // empty list = all enabled; explicit list = only those ids are on
              const isEnabled =
                enabledCalendarIds.length === 0 ||
                enabledCalendarIds.includes(cal.id);

              const isLast = idx === calendars.length - 1;

              return (
                <View key={cal.id}>
                  <Pressable
                    onPress={() => toggleCalendar(cal.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isEnabled }}
                    accessibilityLabel={`${cal.title}, ${isEnabled ? 'visible' : 'hidden'}`}
                    style={({ pressed }) => [row, { opacity: pressed ? t.opacity.pressed : 1 }]}
                  >
                    <Ionicons
                      name={isEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                      size={t.iconSize.md}
                      color={isEnabled ? t.colors.primary : t.colors.inkFaint}
                    />
                    <AppText style={{ ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 }}>
                      {cal.title}
                    </AppText>
                  </Pressable>
                  {!isLast ? <View style={divider} /> : null}
                </View>
              );
            })}
          </>
        ) : null}

        {/* Loading indicator while fetching the list */}
        {showEvents && loading ? (
          <>
            <View style={divider} />
            <View style={[row, { justifyContent: 'center' }]}>
              <ActivityIndicator size="small" color={t.colors.inkSoft} />
            </View>
          </>
        ) : null}
      </View>

      {/* ── Export to Whenbee calendar (Pro) ───────────────────────────────── */}
      {isPro ? (
        <View style={card}>
          <View
            style={row}
            accessibilityRole="none"
          >
            <Ionicons
              name="calendar-sharp"
              size={t.iconSize.md}
              color={t.colors.inkSoft}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <View style={{ flex: 1, gap: t.space[0.5] }}>
              <AppText style={titleStyle}>Add plan to a Whenbee calendar</AppText>
              {exportEnabled ? (
                <AppText style={noteStyle} testID="export-contract-copy">
                  Whenbee uses its own calendar. Turning this off removes those events.
                </AppText>
              ) : (
                <AppText style={noteStyle}>
                  After you run {'"'}Plan my day{'"'}, the schedule goes straight to your calendar.
                </AppText>
              )}
            </View>
            <Switch
              value={exportEnabled}
              onValueChange={handleExportToggle}
              trackColor={{ true: t.colors.primary, false: t.colors.hairline }}
              accessibilityLabel={
                exportEnabled
                  ? 'Add plan to a Whenbee calendar, currently on. Turning this off removes those events.'
                  : 'Add plan to a Whenbee calendar, currently off'
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: exportEnabled }}
            />
          </View>

          {/* Write-access denied hint */}
          {exportWriteDenied ? (
            <AppText style={hintStyle}>
              Calendar access is off. Go to iOS Settings, then Whenbee, then Calendar to allow it.
            </AppText>
          ) : null}
        </View>
      ) : (
        /* Free user: locked row routes to paywall */
        <Pressable
          onPress={openExportPaywall}
          accessibilityRole="button"
          accessibilityLabel="Add plan to a Whenbee calendar — Pro feature. Tap to upgrade."
          style={({ pressed }) => [
            card,
            row,
            { opacity: pressed ? t.opacity.pressed : 1 },
          ]}
        >
          <Ionicons
            name="calendar-sharp"
            size={t.iconSize.md}
            color={t.colors.inkFaint}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={{ flex: 1, gap: t.space[0.5] }}>
            <AppText style={{ ...(type.bodySmBold as unknown as TextStyle), color: t.colors.inkFaint }}>
              Add plan to a Whenbee calendar
            </AppText>
            <AppText style={noteStyle}>
              After you run {'"'}Plan my day{'"'}, the schedule goes straight to your calendar.
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[1] }}>
            <Ionicons name="lock-closed" size={t.iconSize.sm} color={t.colors.inkFaint} accessibilityElementsHidden importantForAccessibility="no" />
            <AppText style={{ ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint }}>
              Pro
            </AppText>
          </View>
        </Pressable>
      )}
    </View>
  );
}
