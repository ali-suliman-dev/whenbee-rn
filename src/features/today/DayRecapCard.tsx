// src/features/today/DayRecapCard.tsx
// Banked recap card for a past selected day.
// Shows what got done — a neutral record, never a score or streak.
// Beneath the stats, a collapsible "All tasks" list (done + any queued).
//
// Design constraints:
//   - No guilt, no streak, no "overdue" language.
//   - Tokens only. No inline hex or raw numbers.
//   - Entering-only animation (no exiting — Fabric SIGABRT risk).
//   - Pressable is a bare touch wrapper; visual state on an inner View.

import { useState } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { weekdayOf } from '@/src/lib/day';
import { fmtHm } from '@/src/lib/time';
import { recapHeadline, recapScale } from './dayRecapCopy';
import { StatColumn } from './StatColumn';
import { TaskRow } from './TaskRow';
import type { TodayRow } from './useToday';
import type { DayRecap } from './useDayRecap';

const SHORT_WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
function shortWeekday(key: string): string {
  return SHORT_WEEKDAY[weekdayOf(key)] ?? key;
}
/** "Tue · Jun 23" — a dated header so the card reads as a record of a real day. */
function datedLabel(key: string): string {
  const parts = key.split('-').map(Number);
  const month = parts[1];
  const day = parts[2];
  if (month === undefined || day === undefined) return shortWeekday(key);
  return `${shortWeekday(key)} · ${SHORT_MONTH[month - 1] ?? ''} ${day}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// DayRecapCard
// ──────────────────────────────────────────────────────────────────────────────

export interface DayRecapCardProps {
  recap: DayRecap;
  /**
   * Pre-resolved TodayRow list for this day (done + queued), as prepared by
   * useToday's toRow() — passed in from index.tsx so we don't re-derive.
   */
  rows: TodayRow[];
}

export function DayRecapCard({ recap, rows }: DayRecapCardProps) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);

  const dayLabel = shortWeekday(recap.date);
  const headerLabel = datedLabel(recap.date);
  const isEmpty = rows.length === 0;

  const headline = recapHeadline(recap);
  const scale = recapScale(recap.guessedMin, recap.honestMin);
  // No guilt: over reads in accent, under in a quiet ink-soft — never danger/red,
  // since running under a guess isn't a win any more than over is a loss.
  const gapColor = headline.direction === 'over' ? t.colors.accent : t.colors.inkSoft;

  // Bar segments: guessed span, honest overhang past it (if any), and the
  // unstyled remainder when the day came in under the guess. `barTotal` guards
  // the degenerate zero-minute case (all segments would be flex:0) so the row
  // still has a nonzero flex sum instead of a division-by-zero collapse.
  const overhangFlex = Math.max(0, recap.honestMin - recap.guessedMin);
  const remainderFlex = Math.max(0, recap.guessedMin - recap.honestMin);
  const barTotal = Math.max(1, recap.guessedMin + overhangFlex + remainderFlex);
  const guessedFlex = recap.guessedMin > 0 ? recap.guessedMin : barTotal;

  // ── Styles ────────────────────────────────────────────────────────────────

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };

  const header: ViewStyle = {
    paddingHorizontal: t.space[4],
    paddingTop: t.space[4],
    paddingBottom: t.space[3],
    gap: t.space[2],
  };

  const eyebrow: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  const headlineStyle: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
  };

  const barTrack: ViewStyle = {
    flexDirection: 'row',
    height: t.capacity.barH,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  };
  const barSegGuessed: ViewStyle = { flex: guessedFlex, backgroundColor: t.colors.primary };
  const barSegOver: ViewStyle = { flex: overhangFlex, backgroundColor: t.colors.accent };
  const barSegRemainder: ViewStyle = { flex: remainderFlex };

  const scaleRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
  };
  const scaleText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  // `borderWidth.hairline` is 0 by design (global card-edge knob) — use `chip`
  // (1) for a divider that actually renders, matching `DaySoFarCard`.
  const divider: ViewStyle = {
    height: t.borderWidth.chip,
    backgroundColor: t.colors.hairline,
    marginHorizontal: t.space[4],
  };

  const statsRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
  };

  const disclosure: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
  };

  const disclosureLabel: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const taskList: ViewStyle = {
    gap: t.space[2],
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[3],
  };

  function toggle() {
    haptics.light();
    setExpanded((v) => !v);
  }

  if (isEmpty) {
    return (
      <View style={card}>
        <View style={header}>
          <Text style={eyebrow}>{headerLabel}</Text>
          <Text style={headlineStyle}>{headline.lead}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={card}>
      {/* Header: dated label + the gap stated in words. */}
      <View style={header}>
        <Text style={eyebrow}>{headerLabel}</Text>
        <Text style={headlineStyle}>
          {headline.lead}
          {headline.gap ? <Text style={{ color: gapColor }}>{headline.gap}</Text> : null}
          {headline.trail}
        </Text>

        <View style={barTrack} testID="recap-bar">
          <View style={barSegGuessed} />
          {overhangFlex > 0 ? <View style={barSegOver} testID="recap-seg-over" /> : null}
          {remainderFlex > 0 ? <View style={barSegRemainder} /> : null}
        </View>

        <View style={scaleRow}>
          <Text style={scaleText}>{scale.left}</Text>
          <Text style={scaleText}>{scale.right}</Text>
        </View>
      </View>

      <View style={divider} />

      {/* Stats — three columns matching the day-so-far card's treatment. */}
      <View style={statsRow}>
        <StatColumn value={String(recap.doneCount)} unit={recap.doneCount === 1 ? 'task' : 'tasks'} label="LOGGED" />
        <StatColumn value={fmtHm(recap.guessedMin)} label="GUESSED" dotColor={t.colors.primary} divided />
        <StatColumn value={fmtHm(recap.honestMin)} label="HONEST" dotColor={t.colors.accent} divided />
      </View>

      {/* Disclosure toggle */}
      <View style={divider} />

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`All tasks · ${dayLabel}. ${expanded ? 'Tap to collapse.' : 'Tap to expand.'}`}
        hitSlop={t.size.hitSlop}
        style={disclosure}
      >
        <Text style={disclosureLabel}>ALL TASKS · {dayLabel.toUpperCase()}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={t.iconSize.sm}
          color={t.colors.inkSoft}
        />
      </Pressable>

      {/* Collapsible task list — entering-only (no exiting, Fabric SIGABRT) */}
      {expanded ? (
        <Animated.View entering={FadeIn.duration(t.motion.base)}>
          <View style={taskList}>
            {rows.map((row) => (
              <TaskRow
                key={row.id}
                title={row.label}
                categoryLabel={row.categoryLabel}
                guessMin={row.guessMin}
                honestMin={row.honestMin}
                actualMin={row.actualMin}
                done={row.done}
                carriedFrom={row.carriedFrom}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
