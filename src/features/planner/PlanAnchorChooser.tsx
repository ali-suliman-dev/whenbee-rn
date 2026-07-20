// src/features/planner/PlanAnchorChooser.tsx
//
// The plan sheet's anchor chooser — two radio rows that decide WHICH END of the
// day is fixed. Fix the start and Whenbee derives the finish; fix the finish and
// Whenbee derives the latest start. Replaces the old standalone Done-by cell.
//
// The copy split is load-bearing, not decoration:
//   • a clock the USER set reads `at`  → row 1 is "Start at"
//   • a clock WHENBEE derived reads `by` → row 1's derived line is "start by …"
// Collapsing both to "start by" would turn a plan into a deadline.
//
// Both rows always render their derived clock, selected or not. Seeing both
// outcomes side by side is the entire point: the choice is a comparison, not a
// guess. The derived clock is quiet mono with a lowercase verb prefix so it never
// reads as settable — the value pill is the only tappable number in a row.
//
// Purely presentational. It takes epoch-ms values and renders them; the route
// wires it to useDayPlan. No motion: rows change state on tap, they do not
// animate in.

import { type ReactElement } from 'react';
import { Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import type { Theme } from '@/src/theme/useTheme';
import { formatClock } from '@/src/lib/time';
import type { PlanAnchorSide } from '@/src/stores/dayTasksStore';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PlanAnchorChooserProps {
  /** Which end of the day is currently fixed. */
  selected: PlanAnchorSide;
  /** The pinned start instant, or null for the live "Now" anchor. */
  startAtMs: number | null;
  /** Where the day ends when the START is fixed — the start row's derived clock. */
  derivedFinishMs: number | null;
  /** The user's done-by target, or null when they have not set one. */
  finishByMs: number | null;
  /** Latest moment work can begin when the FINISH is fixed — row 2's derived clock. */
  derivedStartByMs: number | null;
  /** Where the forward plan actually begins once the lead floor applies. */
  effectiveStartMs: number;
  /** True when the pinned start is already behind effectiveStartMs. */
  startHasPassed: boolean;
  /** Select a row without changing either value. */
  onSelect: (side: PlanAnchorSide) => void;
  /** Open the start picker (the row is selected in the same gesture). */
  onEditStart: () => void;
  /** Open the finish picker (the row is selected in the same gesture). */
  onEditFinish: () => void;
}

/** Rendered when a derived clock exists but the engine placed nothing to read it from. */
const NO_CLOCK = '—';

// ──────────────────────────────────────────────────────────────────────────────
// Derived-line copy
// ──────────────────────────────────────────────────────────────────────────────

/**
 * The start row's derived line.
 *
 * A pinned start that has gone by is never rewritten and never scolded — it is
 * kept and the line simply states what is actually happening instead. No red, no
 * "you missed it" (the no-guilt invariant).
 */
function startDerivedText(
  startAtMs: number | null,
  effectiveStartMs: number,
  startHasPassed: boolean,
  derivedFinishMs: number | null,
): string {
  if (startHasPassed && startAtMs !== null) {
    return `${formatClock(startAtMs)} has passed · starting ${formatClock(effectiveStartMs)}`;
  }
  return derivedFinishMs === null ? NO_CLOCK : `finish ${formatClock(derivedFinishMs)}`;
}

/**
 * The finish row's derived line. With no target set there is no honest latest
 * start to quote — the planner would be answering against a default deadline the
 * user never chose — so the row says so plainly.
 */
function finishDerivedText(finishByMs: number | null, derivedStartByMs: number | null): string {
  if (finishByMs === null) return 'not set';
  return derivedStartByMs === null ? NO_CLOCK : `start by ${formatClock(derivedStartByMs)}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Radio marker
// ──────────────────────────────────────────────────────────────────────────────

function RadioDot({ on }: { on: boolean }): ReactElement {
  const t = useTheme();
  const outer: ViewStyle = {
    width: t.size.radio.dot,
    height: t.size.radio.dot,
    borderRadius: t.radii.full,
    borderWidth: t.size.radio.ring,
    borderColor: on ? t.colors.primary : t.colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  const core: ViewStyle = {
    width: t.size.radio.core,
    height: t.size.radio.core,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primary,
  };
  return <View style={outer}>{on ? <View style={core} /> : null}</View>;
}

// ──────────────────────────────────────────────────────────────────────────────
// One chooser row
// ──────────────────────────────────────────────────────────────────────────────

interface AnchorRowProps {
  testID: string;
  label: string;
  /** The fixed clock this row owns — the only tappable number in the row. */
  valueText: string;
  derivedText: string;
  /** Spoken hint for the value pill — says what picking a time here decides. */
  editHint: string;
  selected: boolean;
  /** The first row omits its top divider so the pair reads as one grouped control. */
  first: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

function AnchorRow({
  testID,
  label,
  valueText,
  derivedText,
  editHint,
  selected,
  first,
  onSelect,
  onEdit,
}: AnchorRowProps): ReactElement {
  const t = useTheme();

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2.5],
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
    minHeight: t.size.chooserRow,
    backgroundColor: selected ? t.colors.surfaceRaised : 'transparent',
    ...(first ? null : { borderTopWidth: t.borderWidth.share, borderTopColor: t.colors.hairline }),
  };
  const main: ViewStyle = { flex: 1, minWidth: 0, gap: t.space[0.5] };
  const labelStyle: TextStyle = {
    fontFamily: t.fontFamily.ui,
    fontSize: t.fontSize.bodySm,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: selected ? t.colors.ink : t.colors.inkSoft,
  };
  // Mono, lowercase-verb-prefixed and never pill-shaped — a derived clock has to
  // be unmistakably a readout, not a control.
  const derivedStyle: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.xs,
    color: selected ? t.colors.accent : t.colors.inkFaint,
  };
  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1.5],
    borderRadius: t.radii.full,
    backgroundColor: selected ? t.colors.surface : 'transparent',
  };
  const pillTextColor = selected ? t.colors.ink : t.colors.inkFaint;
  const pillText: TextStyle = {
    fontFamily: t.fontFamily.mono,
    fontSize: t.fontSize.caption,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: pillTextColor,
  };

  return (
    // Pressable stays a bare touch wrapper — reactCompiler + nativewind drop
    // function-form styles, so every visual lives on the inner View.
    <Pressable
      testID={testID}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label} ${valueText}`}
      accessibilityHint={derivedText}
    >
      <View style={row}>
        <RadioDot on={selected} />
        <View style={main}>
          <Text style={labelStyle} numberOfLines={1}>
            {label}
          </Text>
          <Text style={derivedStyle} numberOfLines={2}>
            {derivedText}
          </Text>
        </View>
        {/* Selects this row AND opens its picker in one gesture. */}
        <Pressable
          testID={`${testID}-value`}
          onPress={() => {
            onSelect();
            onEdit();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${valueText}`}
          accessibilityHint={editHint}
          hitSlop={t.size.hitSlop}
        >
          <View style={pill}>
            <Text style={pillText}>{valueText}</Text>
            <Ionicons name="chevron-forward" size={t.iconSize.xs} color={pillTextColor} />
          </View>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function PlanAnchorChooser({
  selected,
  startAtMs,
  derivedFinishMs,
  finishByMs,
  derivedStartByMs,
  effectiveStartMs,
  startHasPassed,
  onSelect,
  onEditStart,
  onEditFinish,
}: PlanAnchorChooserProps): ReactElement {
  const t: Theme = useTheme();

  const group: ViewStyle = {
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: t.colors.surfaceSunken,
  };

  return (
    <View testID="plan-anchor-chooser" style={group} accessibilityRole="radiogroup">
      <AnchorRow
        testID="plan-anchor-start"
        label="Start at"
        valueText={startAtMs === null ? 'Now' : formatClock(startAtMs)}
        derivedText={startDerivedText(startAtMs, effectiveStartMs, startHasPassed, derivedFinishMs)}
        editHint="Tap to pick when you start. Whenbee works out your finish."
        selected={selected === 'start'}
        first
        onSelect={() => onSelect('start')}
        onEdit={onEditStart}
      />
      <AnchorRow
        testID="plan-anchor-finish"
        label="Finish by"
        valueText={finishByMs === null ? 'Set' : formatClock(finishByMs)}
        derivedText={finishDerivedText(finishByMs, derivedStartByMs)}
        editHint="Tap to pick when you need to be done. Whenbee works out your latest start."
        selected={selected === 'finish'}
        first={false}
        onSelect={() => onSelect('finish')}
        onEdit={onEditFinish}
      />
    </View>
  );
}
