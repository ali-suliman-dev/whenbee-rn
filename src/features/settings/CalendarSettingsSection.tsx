import { useCallback, useEffect, useState } from 'react';
import { View, Switch, Pressable, ActivityIndicator, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { getCalendar } from '@/src/services/calendar';

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
  const setShowEvents = useSettingsStore((s) => s.setShowEvents);
  const toggleCalendar = useSettingsStore((s) => s.toggleCalendar);

  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

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
    </View>
  );
}
