import { useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import type { ScheduledRoutineBlock as ScheduledRoutineBlockModel } from './useScheduledRoutines';

// ──────────────────────────────────────────────────────────────────────────────
// ScheduledRoutineBlock — a collapsible Today-list block for a routine that is
// scheduled to run on the selected day. Derived read: it does not write any task
// rows to the DB; pressing "Run" starts a routine run via routinesStore.startRun.
//
// Appearance: flat card, hairline border, no shadow (flat-over-heavy rule).
// Collapsed: name · {total}m · start by {clock}
// Expanded: steps list with per-step honest minutes.
// Run affordance: always visible in the header row (right-side play button).
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  block: ScheduledRoutineBlockModel;
}

/** Convert minute-of-day (0–1439) to a 12-hour clock string, e.g. 450 → "7:30 AM". */
function minuteOfDayToClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = m < 10 ? `0${m}` : String(m);
  return `${h12}:${mm} ${period}`;
}

export function ScheduledRoutineBlock({ block }: Props) {
  const t = useTheme();
  const startRun = useRoutinesStore((s) => s.startRun);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const handleRun = useCallback(() => {
    void startRun(block.routineId);
    router.push('/(tabs)/routines');
  }, [startRun, block.routineId]);

  const containerStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.md,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    overflow: 'hidden' as const,
    marginBottom: t.space[2],
  };

  const headerStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
    gap: t.space[2],
  };

  const nameStyle = {
    flex: 1,
    fontSize: t.fontSize.base,
    fontWeight: t.fontWeight.semibold as '600',
    color: t.colors.ink,
    fontFamily: t.fontFamily.ui,
  };

  const metaStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
  };

  const chevronName = expanded ? 'chevron-up' : 'chevron-down';

  // Steps panel
  const stepsContainerStyle = {
    borderTopWidth: t.borderWidth.hairline,
    borderTopColor: t.colors.hairline,
    paddingHorizontal: t.space[4],
    paddingTop: t.space[2],
    paddingBottom: t.space[3],
    gap: t.space[2],
  };

  const stepRowStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  };

  const stepLabelStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    fontFamily: t.fontFamily.ui,
    flex: 1 as const,
  };

  const stepMinStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkFaint,
    fontFamily: t.fontFamily.ui,
  };

  return (
    <View style={containerStyle}>
      {/* Header row — always visible */}
      <Pressable
        testID="routine-block-header"
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`${block.name}, ${block.honestTotalMin} minutes${block.startByMin !== null ? `, start by ${minuteOfDayToClock(block.startByMin)}` : ''}. ${expanded ? 'Collapse' : 'Expand'} steps.`}
        accessibilityState={{ expanded }}
        hitSlop={4}
      >
        <View style={headerStyle}>
          {/* Routine name */}
          <AppText style={nameStyle} numberOfLines={1}>
            {block.name}
          </AppText>

          {/* Total + start-by metadata */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
            <AppText style={metaStyle}>{block.honestTotalMin}m</AppText>
            {block.startByMin !== null ? (
              <AppText style={metaStyle}>· start by {minuteOfDayToClock(block.startByMin)}</AppText>
            ) : null}
          </View>

          {/* Chevron */}
          <Ionicons name={chevronName} size={t.iconSize.xs} color={t.colors.inkFaint} />

          {/* Run affordance */}
          <Pressable
            testID="routine-block-run-btn"
            onPress={handleRun}
            accessibilityRole="button"
            accessibilityLabel={`Run ${block.name}`}
            accessibilityHint="Starts the guided timer sequence"
            hitSlop={8}
          >
            <View
              style={{
                width: t.space[8],
                height: t.space[8],
                borderRadius: t.radii.full,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="play" size={t.iconSize.xs} color={t.colors.primary} />
            </View>
          </Pressable>
        </View>
      </Pressable>

      {/* Steps panel — only when expanded */}
      {expanded ? (
        <View style={stepsContainerStyle}>
          {block.steps.map((step) => (
            <View key={step.stepId} style={stepRowStyle}>
              <AppText style={stepLabelStyle} numberOfLines={1}>
                {step.label}
              </AppText>
              <AppText style={stepMinStyle}>{step.honestMin}m</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
