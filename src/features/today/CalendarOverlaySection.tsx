import { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import type { CalendarEvent } from '@/src/services/calendar';
import { fmtHm, formatEventClockPair } from '@/src/lib/time';
import { formatCalendarAge, CALENDAR_AGE_TICK_MS } from './useDayCapacity';

// ──────────────────────────────────────────────────────────────────────────────
// CalendarOverlaySection — read-only calendar events for the selected day.
//
// Collapsed by default (mirrors DoneSection): the header is a 44pt toggle showing
// "CALENDAR · N" + a chevron; tapping reveals the rows with an entering-only FadeIn
// (no exit animation, per the Fabric exiting-crash invariant). Keeping it closed
// keeps the Today screen quiet — calendar is context, not the day's work.
//
// Each timed event is an agenda row built on the SAME skeleton as a Today task row
// (`TaskRow`): title + support on the left, the number pinned right as a value over
// a quiet tail, one gap, no divider. That shared grid is the point — the whole list
// reads on one axis. The row still says "scheduled block" rather than "startable
// task" through weight and colour, not through a different layout.
//
// The right column is start clock over "meridiem – end time", in the user's own
// clock format (`formatEventClockPair`): a 24h user reads "13:00" / "– 14:30" and
// is never shown an AM/PM they don't use. All-day events appear as a quiet
// "All day · …" sub-line and are excluded from capacity math (in useDayCapacity).
//
// This section is display-only — it never writes to the calendar. Pro users only
// (the caller gates visibility; useDayCapacity returns [] for free users, so this
// naturally renders nothing).
//
// Tap on a timed row: best-effort deep link to `calshow:<startMs>` (iOS opens the
// Calendar app to that timestamp). If Linking.openURL rejects, the tap is a no-op.
//
// The header carries the chevron and, once the read is stale, a quiet
// "updated 6m ago" stamp. There is deliberately NO refresh button: the calendar
// re-reads on screen focus, on app foreground, and on Today's pull-to-refresh —
// a permanent glyph for a fourth path was chrome with no job. The stamp stays
// because it is information, not a control.
// ──────────────────────────────────────────────────────────────────────────────

export interface CalendarOverlaySectionProps {
  /** Timed (non-all-day) events for the selected day. */
  events: CalendarEvent[];
  /** All-day events — shown separately; excluded from capacity math. */
  allDayEvents: CalendarEvent[];
  /** Epoch ms of the last calendar read; drives the staleness stamp. */
  lastFetchedAtMs?: number | null;
  /** Clock injection point for tests. Defaults to the live clock. */
  nowMs?: number;
}

/** How long an event runs, e.g. "1h 30m" — the row's left-hand support line. */
function fmtSpan(startMs: number, endMs: number): string {
  return fmtHm(Math.max(0, (endMs - startMs) / 60000));
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
  lastFetchedAtMs = null,
  nowMs,
}: CalendarOverlaySectionProps): React.ReactElement | null {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  // The stamp is a function of elapsed time, so it needs a heartbeat to cross the
  // staleness threshold on its own. A caller-supplied `nowMs` pins the clock
  // (tests) and skips the timer entirely.
  const [tickMs, setTickMs] = useState(() => Date.now());
  const clockPinned = nowMs !== undefined;

  useEffect(() => {
    if (clockPinned) return;
    const id = setInterval(() => setTickMs(Date.now()), CALENDAR_AGE_TICK_MS);
    return () => clearInterval(id);
  }, [clockPinned]);

  const ageLabel = formatCalendarAge(lastFetchedAtMs, nowMs ?? tickMs);

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
    // No paddingVertical: the 32pt action glyphs set the row height, which lands
    // within a point of the old padded-text header. One spacing source per axis.
    marginTop: t.space[2],
  };
  const label: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // The right-hand cluster: age stamp + chevron — one gap, no per-child margins,
  // so the two stay on a shared centre line.
  const headerActions: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[4],
  };
  const ageStamp: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  const glyphBox: ViewStyle = {
    padding: t.size.iconTap.pad,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };
  const glyphSlop = {
    top: t.size.iconTap.slopY,
    bottom: t.size.iconTap.slopY,
    left: t.size.iconTap.slopX,
    right: t.size.iconTap.slopX,
  };

  // Row geometry is TaskRow's, value for value — same gap, padding and minimum
  // height — so a calendar block and a task sit on one grid instead of two.
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    minHeight: t.size.control.lg,
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
  // The right time column — TaskRow's `timeWrap`: value on top, quiet tail under,
  // both right-aligned so every row's numbers share one edge.
  const timeWrap: ViewStyle = {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    gap: t.space[0.5],
  };
  const clockText: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.md,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const tailText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
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
      <View style={header}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`Calendar, ${count} ${count === 1 ? 'event' : 'events'}. ${expanded ? 'Tap to collapse.' : 'Tap to expand.'}`}
          hitSlop={t.size.hitSlop}
        >
          <Text style={label}>CALENDAR · {count}</Text>
        </Pressable>

        <View style={headerActions}>
          {ageLabel ? (
            <Animated.Text entering={FadeIn.duration(t.motion.base)} style={ageStamp}>
              {ageLabel}
            </Animated.Text>
          ) : null}

          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse calendar' : 'Expand calendar'}
            hitSlop={glyphSlop}
          >
            <View style={glyphBox}>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={t.iconSize.sm}
                color={t.colors.inkSoft}
              />
            </View>
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(t.motion.base)} style={{ gap: t.space[2] }}>
          {/* Timed event rows. Calendar events can have an empty title (busy blocks,
              some accounts) — fall back to "Busy" so the row never renders blank. */}
          {events.map((evt) => {
            const title = evt.title?.trim() || 'Busy';
            const span = fmtSpan(evt.startMs, evt.endMs);
            const { clock, tail } = formatEventClockPair(evt.startMs, evt.endMs);
            return (
              <Pressable
                key={evt.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${span}, ${clock} ${tail}, open in Calendar`}
                onPress={() => openInCalendar(evt.startMs)}
              >
                <View style={row}>
                  <View style={body}>
                    <Text style={eventTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <Text style={durationText} numberOfLines={1}>
                      {span}
                    </Text>
                  </View>
                  <View style={timeWrap}>
                    <Text style={clockText}>{clock}</Text>
                    <Text style={tailText}>{tail}</Text>
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
