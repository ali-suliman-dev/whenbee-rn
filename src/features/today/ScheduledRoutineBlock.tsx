import { useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { formatClock } from '@/src/lib/time';
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

/**
 * Minute-of-day → clock string via the shared app formatter (12/24h honoured).
 * Mirrors the `clockFor` helper in RoutinesList.tsx so all routine time displays
 * follow the same system setting instead of hardcoding 12h AM/PM.
 */
function clockFor(minuteOfDay: number): string {
  const d = new Date();
  d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return formatClock(d.getTime());
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
        accessibilityLabel={`${block.name}, ${block.honestTotalMin} minutes${block.startByMin !== null ? `, start by ${clockFor(block.startByMin)}` : ''}. ${expanded ? 'Collapse' : 'Expand'} steps.`}
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
              <AppText style={metaStyle}>· start by {clockFor(block.startByMin)}</AppText>
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
