import { Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ReviewSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// CoverCard — the review's opening: the period eyebrow, a calm lead, and the real
// counts (no fabricated numbers). A zero-log window gets a gentle empty line
// instead of a "0 tasks" callout — the ritual is the point, not a quota.
// ──────────────────────────────────────────────────────────────────────────────

/** "2h 15m" from whole minutes; "0m" never shows on a real window (count gates it). */
function formatLogged(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function CoverCard({ summary }: { summary: ReviewSummary }) {
  const t = useTheme();
  const isMonth = summary.period.kind === 'month';

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const title: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const count: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const block: ViewStyle = { gap: t.space[2] };

  const eyebrowText = isMonth ? 'YOUR HONEST MONTH' : 'YOUR HONEST WEEK';
  const leadText = isMonth
    ? 'A month is in. Here is where your time actually went.'
    : 'Seven days are in. Here is where your time actually went.';

  return (
    <Card tone="flat" style={block}>
      <Text style={eyebrow}>{eyebrowText}</Text>
      <Text style={title}>{summary.period.label}</Text>
      {summary.loggedCount > 0 ? (
        <Text style={count}>
          {summary.loggedCount} {summary.loggedCount === 1 ? 'task' : 'tasks'} ·{' '}
          {formatLogged(summary.loggedMinutes)} logged
        </Text>
      ) : (
        <Text style={lead}>Nothing logged this time. No problem — the next one is always open.</Text>
      )}
      {summary.loggedCount > 0 ? <Text style={lead}>{leadText}</Text> : null}
    </Card>
  );
}
