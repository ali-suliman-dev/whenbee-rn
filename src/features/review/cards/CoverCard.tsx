import { Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatDuration } from '@/src/i18n/formatDuration';
import type { ReviewSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// CoverCard — the review's opening: the period eyebrow, a calm lead, and the real
// counts (no fabricated numbers). A zero-log window gets a gentle empty line
// instead of a "0 tasks" callout — the ritual is the point, not a quota.
// ──────────────────────────────────────────────────────────────────────────────

export function CoverCard({ summary }: { summary: ReviewSummary }) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  const { t: translate } = useTranslation();
  const isMonth = summary.period.kind === 'month';

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const title: TextStyle = { ...(type.title as unknown as TextStyle), color: t.colors.ink };
  const lead: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const count: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };
  const block: ViewStyle = { gap: t.space[2] };

  const eyebrowText = tt(isMonth ? 'eyebrow.month' : 'eyebrow.week');
  const leadText = tt(isMonth ? 'cover.leadMonth' : 'cover.leadWeek');

  return (
    <Card tone="flat" style={block}>
      <Text style={eyebrow}>{eyebrowText}</Text>
      <Text style={title}>{summary.period.label}</Text>
      {summary.loggedCount > 0 ? (
        <Text style={count}>
          {tt('cover.loggedSummary', {
            count: summary.loggedCount,
            logged: formatDuration(summary.loggedMinutes, translate),
          })}
        </Text>
      ) : (
        <Text style={lead}>{tt('cover.emptyLead')}</Text>
      )}
      {summary.loggedCount > 0 ? <Text style={lead}>{leadText}</Text> : null}
    </Card>
  );
}
