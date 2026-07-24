// src/features/today/DaySoFarCard.tsx
// The Today "Your day so far" recap card — shown only on a sparse-done day
// (see useDaySoFar / daySoFar.ts for the visibility rule). Tells the day's
// story from real logged values only; nothing here is fabricated.
//
// Design constraints:
//   - Tokens only. No inline hex or raw px.
//   - Flat surface card, no shadow, matching sibling Today cards.
//   - Opacity-fade entrance only; plain unmount (no exiting animation).
//   - The ONE founder-approved accent-text exception: the "{n} real minutes"
//     span in the headline renders in `t.colors.accent`. Every other run of
//     text stays ink/inkSoft/inkFaint.

import type { ReactNode } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { countLine, minutesPhrase, milestoneText } from '@/src/features/today/daySoFar';
import type { DaySoFar } from '@/src/features/today/useDaySoFar';

// ──────────────────────────────────────────────────────────────────────────────
// Stat column — value stacked over its label. Every column shares the exact
// same element shape / gap / zero per-column margins so the three baselines
// line up (the one-spacing-source-per-axis rule).
// ──────────────────────────────────────────────────────────────────────────────

interface StatColumnProps {
  value: string;
  unit: string;
  label: string;
  /** Extra content rendered under the value/unit row (the mini honey bar). */
  children?: ReactNode;
  /** Vertical hairline divider on the left edge — every column but the first. */
  divided?: boolean;
}

function StatColumn({ value, unit, label, children, divided = false }: StatColumnProps) {
  const t = useTheme();

  const col: ViewStyle = {
    flex: 1,
    alignItems: 'flex-start',
    gap: t.space[1],
    ...(divided
      ? { borderLeftWidth: t.borderWidth.chip, borderLeftColor: t.colors.hairline, paddingLeft: t.space[3] }
      : null),
  };
  const valueRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline' };
  const valueText: TextStyle = {
    fontFamily: 'Inter-Bold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.lg,
    lineHeight: t.fontSize.lg * t.lineHeight.tight,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  // Muted unit suffix at ~0.6em of the value — `sm` (12) against `lg` (20) is the
  // closest token ratio to that rule (0.6 exactly).
  const unitText: TextStyle = {
    fontFamily: 'Inter-SemiBold' as TextStyle['fontFamily'],
    fontSize: t.fontSize.sm,
    color: t.colors.ink,
    marginLeft: t.space[1],
  };
  const labelText: TextStyle = {
    ...(type.eyebrowSm as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  return (
    <View style={col}>
      <View style={valueRow}>
        <Text style={valueText}>{value}</Text>
        <Text style={unitText}>{unit}</Text>
      </View>
      <Text style={labelText}>{label}</Text>
      {children}
    </View>
  );
}

function MiniHoneyBar({ pct }: { pct: number }) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));

  const track: ViewStyle = {
    width: t.miniHoneyBar.width,
    height: t.miniHoneyBar.height,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.honeyWash,
    overflow: 'hidden',
    marginTop: t.space[0.5],
  };
  const fill: ViewStyle = {
    width: `${clamped}%`,
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  return (
    <View
      style={track}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: clamped, min: 0, max: 100 }}
    >
      <View style={fill} />
    </View>
  );
}

export interface DaySoFarCardProps {
  recap: DaySoFar;
}

export function DaySoFarCard({ recap }: DaySoFarCardProps) {
  const t = useTheme();
  const { completedCount, totalMin, honeyPct, leadCategoryLabel, logsToNextTier } = recap;

  const milestone = milestoneText(leadCategoryLabel, logsToNextTier);
  const minutes = minutesPhrase(totalMin);
  const milestoneBoldEnd = milestone.boldPrefix?.length ?? 0;

  const card: ViewStyle = {
    // Self-managed vertical margins — the parent Animated.View stacks Today's
    // sections with no shared gap (see CalendarOverlaySection, the sibling that
    // does the same), so each section owns its own spacing. Tight above (hugs the
    // calendar strip) and a wider gap below to set the Done list apart.
    marginTop: t.space[1],
    marginBottom: t.space[4],
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
  const headline: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
  };
  // `borderWidth.hairline` is 0 by design (global card-edge knob) — use `chip`
  // (1) for a divider that actually renders, same fix the brief calls out for
  // the vertical stat-column rules.
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
  const milestoneRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[2],
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const glyph: TextStyle = {
    color: t.colors.accent,
    fontSize: t.fontSize.sm,
    lineHeight: (type.caption as unknown as TextStyle).lineHeight,
  };
  const milestoneCopy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };
  const milestoneBold: TextStyle = { fontWeight: t.fontWeight.bold as TextStyle['fontWeight'], color: t.colors.ink };

  return (
    <Animated.View entering={FadeIn.duration(t.motion.base)} style={card}>
      <View style={header}>
        <Text style={eyebrow}>YOUR DAY SO FAR</Text>
        <Text style={headline}>
          {countLine(completedCount)}{' '}
          <Text style={{ color: t.colors.accent }}>{minutes}</Text> on the books.
        </Text>
      </View>

      <View style={divider} />

      <View style={statsRow}>
        <StatColumn value={String(completedCount)} unit={completedCount === 1 ? 'task' : 'tasks'} label="LOGGED" />
        <StatColumn value={String(totalMin)} unit="min" label="REALLY TOOK" divided />
        <StatColumn value={String(honeyPct)} unit="%" label="HONEY" divided>
          <MiniHoneyBar pct={honeyPct} />
        </StatColumn>
      </View>

      <View style={divider} />

      <View style={milestoneRow}>
        <Text style={glyph}>{'⬢'}</Text>
        <Text style={milestoneCopy}>
          {milestone.boldPrefix ? (
            <>
              <Text style={milestoneBold}>{milestone.text.slice(0, milestoneBoldEnd)}</Text>
              {milestone.text.slice(milestoneBoldEnd)}
            </>
          ) : (
            milestone.text
          )}
        </Text>
      </View>
    </Animated.View>
  );
}
