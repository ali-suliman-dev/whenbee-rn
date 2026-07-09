import { useState } from 'react';
import { View, Text, Pressable, Linking, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import type { CalendarEvent } from '@/src/services/calendar';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar events for the selected day.
//
// Collapsed by default (mirrors DoneSection): the header is a 44pt toggle showing
// "CALENDAR · N" + a chevron; tapping reveals the rows with an entering-only FadeIn
// (no exit animation, per the Fabric exiting-crash invariant). Keeping it closed
// keeps the Today screen quiet — calendar is context, not the day's work.
//
// Each timed event is an agenda row: a left time-column (start clock + AM/PM) and a
// thin rail, then the title + duration. This reads as a *scheduled block* — visually
// distinct from the startable indigo task rows above, so it's never mistaken for a
// Whenbee task. All-day events appear as a quiet "All day · …" sub-line and are
// excluded from capacity math (that happens in useDayCapacity).
//
// This section is display-only — it never writes to the calendar. Pro users only
// (the caller gates visibility; useDayCapacity returns [] for free users, so this
// naturally renders nothing).
//
// Tap on a timed row: best-effort deep link to `calshow:<startMs>` (iOS opens the
// Calendar app to that timestamp). If Linking.openURL rejects, the tap is a no-op.
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

/** Split a start epoch into its clock ("1:30") and meridiem ("PM") for the time-column. */
function fmtClock(epochMs: number): { clock: string; meridiem: string } {
  const d = new Date(epochMs);
  const h24 = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { clock: `${h12}:${min}`, meridiem: h24 < 12 ? 'AM' : 'PM' };
}

/** Compact duration + end time, e.g. "1h 30m · until 3:00 PM" or "30m · until 4:30 PM". */
function fmtDuration(startMs: number, endMs: number): string {
  const totalMin = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const dur = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return `${dur} · until ${fmtTime(endMs)}`;
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
  const [expanded, setExpanded] = useState(false);

  const count = events.length + allDayEvents.length;
  if (count === 0) return null;

  function toggle() {
    haptics.light();
    setExpanded((v) => !v);
  }

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.space[2],
    marginTop: t.space[2],
  };
  const label: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const timeCol: ViewStyle = {
    minWidth: t.size.calTimeCol,
    justifyContent: 'center',
  };
  const clockText: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const meridiemText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.inkFaint,
    marginTop: t.space[0.5],
  };
  const rail: ViewStyle = {
    width: t.space[0.5],
    borderRadius: t.radii.full,
    backgroundColor: t.colors.inkFaint,
  };
  const body: ViewStyle = { flex: 1, justifyContent: 'center', gap: t.space[0.5] };
  const eventTitle: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const durationText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const allDayText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    paddingHorizontal: t.space[4],
    paddingTop: t.space[1],
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Calendar, ${count} ${count === 1 ? 'event' : 'events'}. ${expanded ? 'Tap to collapse.' : 'Tap to expand.'}`}
        hitSlop={t.size.hitSlop}
        style={header}
      >
        <Text style={label}>CALENDAR · {count}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={t.iconSize.sm}
          color={t.colors.inkSoft}
        />
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(t.motion.base)} style={{ gap: t.space[2] }}>
          {/* Timed event rows. Calendar events can have an empty title (busy blocks,
              some accounts) — fall back to "Busy" so the row never renders blank. */}
          {events.map((evt) => {
            const title = evt.title?.trim() || 'Busy';
            const { clock, meridiem } = fmtClock(evt.startMs);
            return (
              <Pressable
                key={evt.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${clock} ${meridiem}, ${fmtDuration(evt.startMs, evt.endMs)}, open in Calendar`}
                onPress={() => openInCalendar(evt.startMs)}
              >
                <View style={row}>
                  <View style={timeCol}>
                    <Text style={clockText}>{clock}</Text>
                    <Text style={meridiemText}>{meridiem}</Text>
                  </View>
                  <View style={rail} />
                  <View style={body}>
                    <Text style={eventTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={durationText} numberOfLines={1}>
                      {fmtDuration(evt.startMs, evt.endMs)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}

          {/* All-day events sub-line — excluded from capacity math */}
          {allDayEvents.length > 0 ? (
            <Text style={allDayText}>
              All day · {allDayEvents.map((e) => e.title?.trim() || 'Busy').join(', ')}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}
