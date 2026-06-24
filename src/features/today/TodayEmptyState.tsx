import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { RetroLogChip } from './RetroLogChip';

// ──────────────────────────────────────────────────────────────────────────────
// TodayEmptyState — the body when nothing is scheduled. Three variants:
//   • first-run  — the user has never logged. One job: reach the first log fast.
//   • daily      — a returning user with an empty day. No guilt; a gentle plan
//                  invite with one clear way to start.
//   • future     — a future day with no tasks yet. Invite, not deficit.
//                  Pass `weekday` (e.g. "Thursday") for the heading.
// The companion presence lives in the header honey ring above; this body stays calm + actionable.
// All copy follows the no-guilt rule: no "overdue", no red, no shame mechanics.
// ──────────────────────────────────────────────────────────────────────────────

interface TodayEmptyStateProps {
  variant: 'first-run' | 'daily' | 'future';
  /** Full weekday name shown in the future-variant heading (e.g. "Thursday"). */
  weekday?: string;
  /** Primary CTA — start the first task (first-run) / plan a task (daily/future). */
  onPrimary: () => void;
  /** Secondary chip — open the retro-log flow. */
  onLog: () => void;
}

export function TodayEmptyState({ variant, weekday, onPrimary, onLog }: TodayEmptyStateProps) {
  const t = useTheme();
  const isFirstRun = variant === 'first-run';
  const isFuture = variant === 'future';

  const eyebrowText = isFirstRun ? null : isFuture ? null : 'Nothing on yet';

  const lead = isFirstRun
    ? 'Time your first task'
    : isFuture
      ? `${weekday ?? 'That day'}'s wide open`
      : "What's on today?";

  const sub = isFirstRun
    ? "That's all it takes for Whenbee to start learning your real numbers, the ones you can plan around."
    : isFuture
      ? "Add what future-you should tackle — it carries over free if life happens."
      : "Add a task and I'll show its honest finish, plus whether the day actually fits.";

  const primaryLabel = isFirstRun ? 'Start now' : isFuture ? 'Plan ahead' : 'Plan a task';
  const chipLabel = isFirstRun ? 'Already finished something? Log it' : 'Or log something you finished';

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

  return (
    <View style={{ gap: t.space[4] }}>
      <View style={block}>
        {eyebrowText != null ? <Text style={eyebrow}>{eyebrowText}</Text> : null}
        <Text style={leadText}>{lead}</Text>
        <Text style={subText}>{sub}</Text>
      </View>

      <AppButton label={primaryLabel} variant="indigo" fullWidth onPress={onPrimary} />

      <RetroLogChip label={chipLabel} onPress={onLog} />
    </View>
  );
}
