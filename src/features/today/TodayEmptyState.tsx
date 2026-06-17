import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatReclaim } from '@/src/engine';
import { RetroLogChip } from './RetroLogChip';

// ──────────────────────────────────────────────────────────────────────────────
// TodayEmptyState — the body when nothing is tracked today. Two variants:
//   • first-run  — the user has never logged. One job: reach the first log fast.
//   • daily      — a returning user with an empty day. No guilt; a gentle plan
//                  invite, plus the lifetime reclaim as quiet proof.
// The companion presence lives in TodayHud above; this body stays calm + actionable.
// All copy is verbatim from the spec copy deck (no em dashes, no guilt language).
// ──────────────────────────────────────────────────────────────────────────────

interface TodayEmptyStateProps {
  variant: 'first-run' | 'daily';
  /** Lifetime minutes reclaimed; the proof line shows only on the daily variant when ≥ 1. */
  reclaimLifetimeMin: number;
  /** Primary CTA — start the first task (first-run) / plan a task (daily). */
  onPrimary: () => void;
  /** Secondary chip — open the retro-log flow. */
  onLog: () => void;
}

export function TodayEmptyState({ variant, reclaimLifetimeMin, onPrimary, onLog }: TodayEmptyStateProps) {
  const t = useTheme();
  const isFirstRun = variant === 'first-run';

  const lead = isFirstRun ? 'Time your first task' : "What's on today?";
  const sub = isFirstRun
    ? "That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around."
    : "Add a task and I'll show its honest finish, plus whether the day actually fits.";
  const primaryLabel = isFirstRun ? 'Start now' : 'Plan a task';
  const chipLabel = isFirstRun ? 'Already finished something? Log it' : 'Or log something you finished';
  const showReclaim = !isFirstRun && reclaimLifetimeMin >= 1;

  const block: ViewStyle = { alignItems: 'center', gap: t.space[2], marginTop: t.space[8] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const leadText: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
    textAlign: 'center',
  };
  const subText: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    textAlign: 'center',
  };
  const reclaimRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
    marginTop: t.space[3],
  };
  const reclaimText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.amberText };

  return (
    <View style={{ gap: t.space[4] }}>
      <View style={block}>
        {isFirstRun ? null : <Text style={eyebrow}>Nothing on yet</Text>}
        <Text style={leadText}>{lead}</Text>
        <Text style={subText}>{sub}</Text>
      </View>

      <AppButton label={primaryLabel} variant="indigo" fullWidth onPress={onPrimary} />

      {showReclaim ? (
        <View style={reclaimRow}>
          <Ionicons name="sparkles-outline" size={t.iconSize.sm} color={t.colors.accent} />
          <Text style={reclaimText}>{formatReclaim(reclaimLifetimeMin)} reclaimed so far</Text>
        </View>
      ) : null}

      <RetroLogChip label={chipLabel} onPress={onLog} />
    </View>
  );
}
