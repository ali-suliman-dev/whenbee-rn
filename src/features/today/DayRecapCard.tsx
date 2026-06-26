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
// Stat column — a value stacked over its label. Sibling columns share identical
// vertical structure (same gap, no per-column margins) so the values sit on one
// baseline and the labels line up beneath them.
// ──────────────────────────────────────────────────────────────────────────────
interface StatColumnProps {
  value: string;
  label: string;
  /** Tints the value (used for the "ran faster" vs-guess case). Default = ink. */
  tone?: 'ink' | 'soft';
}

function StatColumn({ value, label, tone = 'ink' }: StatColumnProps) {
  const t = useTheme();
  const col: ViewStyle = {
    flex: 1,
    alignItems: 'flex-start',
    gap: t.space[1],
  };
  const val: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.lg,
    lineHeight: t.fontSize.lg * t.lineHeight.tight,
    color: tone === 'soft' ? t.colors.inkSoft : t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const lbl: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    fontWeight: t.fontWeight.regular as TextStyle['fontWeight'],
  };

  return (
    <View style={col}>
      <Text style={val}>{value}</Text>
      <Text style={lbl}>{label}</Text>
    </View>
  );
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
  const vsSign = recap.vsGuessMin >= 0 ? '+' : '';
  // Ran-under-guess reads as a quiet positive (no guilt either way); ran-over stays
  // neutral ink. Never red, never a score.
  const vsTone = recap.vsGuessMin < 0 ? 'soft' : 'ink';
  const isEmpty = rows.length === 0;

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
  };

  const dayTitle: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const divider: ViewStyle = {
    height: t.borderWidth.hairline || 1,
    backgroundColor: t.colors.hairline,
    marginHorizontal: t.space[4],
  };

  const statsRow: ViewStyle = {
    flexDirection: 'row',
    gap: t.space[3],
    paddingHorizontal: t.space[4],
    paddingTop: t.space[0.5],
    paddingBottom: t.space[4],
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

  const emptyText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    fontSize: t.fontSize.xs,
    color: t.colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: t.space[4],
    paddingBottom: t.space[3],
  };

  function toggle() {
    haptics.light();
    setExpanded((v) => !v);
  }

  return (
    <View style={card}>
      {/* Header: dated label — reads as a record of a specific day */}
      <View style={header}>
        <Text style={dayTitle}>{headerLabel}</Text>
      </View>

      {/* Stats — three equal columns, value over label */}
      <View style={statsRow}>
        <StatColumn value={`${recap.doneCount} of ${recap.plannedCount}`} label="done" />
        <StatColumn value={`${recap.realFocusMin}m`} label="real focus" />
        <StatColumn value={`${vsSign}${recap.vsGuessMin}m`} label="vs your guess" tone={vsTone} />
      </View>

      {/* Empty past day: quiet single-line, no toggle needed */}
      {isEmpty ? (
        <>
          <View style={divider} />
          <Text style={emptyText}>Nothing logged that day</Text>
        </>
      ) : (
        <>
          {/* Disclosure toggle — only shown when tasks exist */}
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
        </>
      )}
    </View>
  );
}
