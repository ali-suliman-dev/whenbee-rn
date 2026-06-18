import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { Card } from '@/src/components/Card';
import { formatClock } from '@/src/lib/time';
import type { PlanVerdict } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// VerdictCard — the deterministic plan verdict (display only).
//
//   fits      → a quiet positive: low-emphasis indigo fill, ink text.
//   over cases (cut-one / multi-cut / push-deadline) → a CALM neutral heads-up:
//               sunken surface + hairline border + ink text (never red — red is
//               reserved for Abandon; there's no guilt here).
//
// The card carries the *explanation* only. The matching action (cut / push) is an
// amber button that lives in BuildView's footer beside "Build my plan", so the
// one tappable decision sits with the primary CTA.
// ──────────────────────────────────────────────────────────────────────────────

export function VerdictCard({
  verdict,
  deadline,
}: {
  verdict: PlanVerdict;
  deadline: number;
}) {
  const t = useTheme();

  // Calm neutral "heads-up" — no amber, no red.
  const noticeCard = {
    backgroundColor: t.colors.surfaceSunken,
    borderColor: t.colors.border,
  };

  if (verdict.kind === 'fits') {
    return (
      <Card style={{ backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary }}>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          This fits. Start on time and you&apos;ll land by {formatClock(deadline)}.
        </AppText>
      </Card>
    );
  }

  if (verdict.kind === 'cut-one') {
    return (
      <Card style={noticeCard}>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          Drop{' '}
          <AppText style={{ fontWeight: t.fontWeight.bold, color: t.colors.ink }}>
            {verdict.cut.label}
          </AppText>{' '}
          and you start on time — that&apos;s {verdict.savedMin}m back.
        </AppText>
      </Card>
    );
  }

  if (verdict.kind === 'multi-cut') {
    const names = verdict.cuts.map((c) => c.label).join(', ');
    return (
      <Card style={noticeCard}>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          A bit more than today holds. Drop {names} to start on time — saves {verdict.savedMin}m.
        </AppText>
      </Card>
    );
  }

  // push-deadline
  return (
    <Card style={noticeCard}>
      <View>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          About {verdict.overshootMin}m over. Push the finish to {formatClock(verdict.feasibleDeadline)},
          or drop a task.
        </AppText>
      </View>
    </Card>
  );
}
