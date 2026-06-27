import { View, Text, Pressable, Linking, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalendarEvent } from '@/src/services/calendar';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar events for the selected day.
//
// Renders when at least one timed or all-day event is present. Timed events
// show title + clock range ("2:00–3:00 PM"). All-day events appear as a quiet
// sub-line ("All day: Holiday, Offsite"). This section is display-only — it
// never writes to the calendar. Pro users only (the caller gates visibility;
// useDayCapacity returns [] for free users, so this naturally renders nothing).
//
// Tap on a timed row: best-effort deep link to `calshow:<startMs>` (iOS opens
// the Calendar app to that timestamp). If Linking.openURL rejects, the tap is
// a no-op — nothing is written.
//
// All-day events are excluded from capacity math (that happens in useDayCapacity).
// ──────────────────────────────────────────────────────────────────────────────

export interface CalendarOverlaySectionProps {
  /** Timed (non-all-day) events for the selected day. */
  events: CalendarEvent[];
  /** All-day events — shown separately; excluded from capacity math. */
  allDayEvents: CalendarEvent[];
}

/** Format an epoch ms as a short local time string, e.g. "2:00 PM" or "9:30 AM". */
function fmtTime(epochMs: number): string {
  const d = new Date(epochMs);
  const h24 = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${meridiem}`;
}

/** "2:00 PM–3:00 PM" range string for a timed event. */
function fmtRange(startMs: number, endMs: number): string {
  return `${fmtTime(startMs)}–${fmtTime(endMs)}`;
}

/** Attempt to open the iOS Calendar app at a given epoch; silently no-ops if unavailable. */
function openInCalendar(startMs: number): void {
  // `calshow:` is an iOS URL scheme that jumps to a specific Unix-epoch second.
  // It is not available on all devices/configurations; errors are caught and ignored.
  void Linking.openURL(`calshow:${Math.floor(startMs / 1000)}`).catch(() => {
    // No-op — calshow may not be supported in simulators or some configurations.
  });
}

export function CalendarOverlaySection({
  events,
  allDayEvents,
}: CalendarOverlaySectionProps): React.ReactElement | null {
  const t = useTheme();

  const hasAny = events.length > 0 || allDayEvents.length > 0;
  if (!hasAny) return null;

  const sectionWrap: ViewStyle = {
    gap: t.space[2.5],
    marginTop: t.space[4],
    marginBottom: t.space[2],
  };

  const eyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const rowWrap: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.space[1.5],
    paddingHorizontal: t.space[3],
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.md,
  };

  const eventTitle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };

  const timeRange: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    marginLeft: t.space[2],
  };

  const allDayWrap: ViewStyle = {
    paddingVertical: t.space[1],
    paddingHorizontal: t.space[3],
  };

  const allDayText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  return (
    <View style={sectionWrap}>
      <Text style={eyebrow}>Calendar</Text>

      {/* Timed event rows. Calendar events can have an empty title (busy blocks,
          some accounts) — fall back to "Busy" so the row never renders blank. */}
      {events.map((evt) => {
        const title = evt.title?.trim() || 'Busy';
        return (
          <Pressable
            key={evt.id}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${fmtRange(evt.startMs, evt.endMs)}, open in Calendar`}
            onPress={() => openInCalendar(evt.startMs)}
          >
            <View style={rowWrap}>
              <Text style={eventTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={timeRange}>{fmtRange(evt.startMs, evt.endMs)}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* All-day events sub-line — excluded from capacity math */}
      {allDayEvents.length > 0 && (
        <View style={allDayWrap}>
          <Text style={allDayText}>
            All day: {allDayEvents.map((e) => e.title).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}
