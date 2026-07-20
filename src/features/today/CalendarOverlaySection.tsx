import { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import type { CalendarEvent } from '@/src/services/calendar';
import { formatCalendarAge, CALENDAR_AGE_TICK_MS } from './useDayCapacity';

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
//
// The header carries a refresh glyph grouped right with the chevron, plus a quiet
// "updated 6m ago" stamp that only appears once the read is stale. Fresh: the
// glyph sits at inkSoft on a transparent chip and there is no stamp. Stale: the
// chip fills with primaryChip and the glyph lifts to primaryBright. The chip's
// geometry is identical in both states, so going stale changes colour only —
// nothing in the row shifts.
// ──────────────────────────────────────────────────────────────────────────────

export interface CalendarOverlaySectionProps {
  /** Timed (non-all-day) events for the selected day. */
  events: CalendarEvent[];
  /** All-day events — shown separately; excluded from capacity math. */
  allDayEvents: CalendarEvent[];
  /** Epoch ms of the last calendar read; drives the staleness stamp. */
  lastFetchedAtMs?: number | null;
  /** Re-reads the calendar. Omit to render no refresh glyph at all. */
  onRefresh?: () => void;
  /** True while a refresh is in flight — the glyph dims and stops accepting taps. */
  refreshing?: boolean;
  /** Clock injection point for tests. Defaults to the live clock. */
  nowMs?: number;
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
  lastFetchedAtMs = null,
  onRefresh,
  refreshing = false,
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
  const stale = ageLabel !== null;

  const count = events.length + allDayEvents.length;
  if (count === 0) return null;

  function toggle() {
    haptics.light();
    setExpanded((v) => !v);
  }

  function handleRefresh() {
    if (refreshing) return;
    haptics.light();
    onRefresh?.();
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
  // The right-hand cluster: age stamp, refresh glyph, chevron — one gap, no
  // per-child margins, so the three stay on a shared centre line.
  const headerActions: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    // Exactly 2 × iconTap.slopX, so the two glyphs' touch regions meet edge to
    // edge and neither can steal the other's taps.
    gap: t.space[4],
  };
  const ageStamp: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };
  /** Shared 32pt box behind a header glyph — identical geometry for both. */
  const glyphBox: ViewStyle = {
    padding: t.size.iconTap.pad,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
  };
  const refreshChip: ViewStyle = {
    ...glyphBox,
    // Transparent when fresh: same box, colour is the only thing that changes,
    // so going stale never shifts anything in the row.
    backgroundColor: stale ? t.colors.primaryChip : 'transparent',
    opacity: refreshing ? t.opacity.disabled : 1,
  };
  const glyphSlop = {
    top: t.size.iconTap.slopY,
    bottom: t.size.iconTap.slopY,
    left: t.size.iconTap.slopX,
    right: t.size.iconTap.slopX,
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

          {onRefresh ? (
            <Pressable
              onPress={handleRefresh}
              accessibilityRole="button"
              accessibilityState={{ busy: refreshing, disabled: refreshing }}
              accessibilityLabel={
                ageLabel ? `Refresh calendar, ${ageLabel}` : 'Refresh calendar'
              }
              hitSlop={glyphSlop}
            >
              <View style={refreshChip}>
                <Ionicons
                  name="refresh"
                  size={t.iconSize.sm}
                  color={stale ? t.colors.primaryBright : t.colors.inkSoft}
                />
              </View>
            </Pressable>
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
