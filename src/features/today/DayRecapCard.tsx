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
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';
import { fmtHm } from '@/src/lib/time';
import { recapHeadline, recapScale } from './dayRecapCopy';
import { StatColumn } from './StatColumn';
import { useLocalizedFormat } from '@/src/i18n/useLocalizedFormat';
import { TaskRow } from './TaskRow';
import type { TodayRow } from './useToday';
import type { DayRecap } from './useDayRecap';

function dateOf(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Short weekday, e.g. "Tue" — locale-aware. */
function shortWeekday(key: string, fmt: ReturnType<typeof useLocalizedFormat>): string {
  return fmt.weekdayShort(dateOf(key));
}
/** "Tue · Jun 23" — a dated header so the card reads as a record of a real day. */
function datedLabel(key: string, fmt: ReturnType<typeof useLocalizedFormat>): string {
  return `${fmt.weekdayShort(dateOf(key))} · ${fmt.monthDay(dateOf(key))}`;
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
  const { t: tr } = useTranslation('today');
  const fmt = useLocalizedFormat();
  const [expanded, setExpanded] = useState(false);

  const dayLabel = shortWeekday(recap.date, fmt);
  const headerLabel = datedLabel(recap.date, fmt);
  // Keyed on doneCount, not rows.length: a past day can carry queued (not-done)
  // rows in `rows` (leftover tasks never logged that day) while doneCount is 0 —
  // that's still an empty day for this card's purposes.
  const isEmpty = recap.doneCount === 0;

  const headline = recapHeadline(recap);
  const scale = recapScale(recap.guessedMin, recap.honestMin);
  // No guilt: over reads in accent, under in a quiet ink-soft — never danger/red,
  // since running under a guess isn't a win any more than over is a loss.
  const gapColor = headline.direction === 'over' ? t.colors.accent : t.colors.inkSoft;

  // Bar segments: the primary segment is only what guessed and honest actually
  // overlap on — min(guessed, honest) — so its share of the track always matches
  // the fraction the scale row states underneath. An OVER day adds an amber
  // overhang past that (honest − guessed); an UNDER day adds an unstyled
  // remainder for the guessed time that never happened (guessed − honest).
  // Track total is max(guessed, honest) either way — RN flex normalizes only
  // among the segments actually rendered, so a 0/0 day (a done task logged with
  // no actualMin) just renders an empty track, never a fabricated full fill.
  const primaryFlex = Math.min(recap.guessedMin, recap.honestMin);
  const overhangFlex = Math.max(0, recap.honestMin - recap.guessedMin);
  const remainderFlex = Math.max(0, recap.guessedMin - recap.honestMin);

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
  const barSegGuessed: ViewStyle = { flex: primaryFlex, backgroundColor: t.colors.primary };
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
          <View style={barSegGuessed} testID="recap-seg-guessed" />
          {overhangFlex > 0 ? <View style={barSegOver} testID="recap-seg-over" /> : null}
          {remainderFlex > 0 ? <View style={barSegRemainder} testID="recap-seg-remainder" /> : null}
        </View>

        <View style={scaleRow}>
          <Text style={scaleText}>{scale.left}</Text>
          <Text style={scaleText}>{scale.right}</Text>
        </View>
      </View>

      <View style={divider} />

      {/* Stats — three columns matching the day-so-far card's treatment. */}
      <View style={statsRow}>
        <StatColumn value={String(recap.doneCount)} unit={recap.doneCount === 1 ? 'task' : 'tasks'} label={tr('daySoFar.loggedLabel')} />
        <StatColumn value={fmtHm(recap.guessedMin)} label={tr('daySoFar.guessedLabel')} dotColor={t.colors.primary} divided />
        <StatColumn value={fmtHm(recap.honestMin)} label={tr('daySoFar.honestLabel')} dotColor={t.colors.accent} divided />
      </View>

      {/* Disclosure toggle */}
      <View style={divider} />

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={tr('dayRecap.allTasksA11y', {
          day: dayLabel,
          action: expanded ? tr('dayRecap.collapseAction') : tr('dayRecap.expandAction'),
        })}
        hitSlop={t.size.hitSlop}
        style={disclosure}
      >
        <Text style={disclosureLabel}>{tr('dayRecap.allTasksLabel', { day: dayLabel.toUpperCase() })}</Text>
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
