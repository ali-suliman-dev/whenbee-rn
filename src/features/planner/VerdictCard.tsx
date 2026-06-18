import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { formatClock } from '@/src/lib/time';
import type { PlanVerdict } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// VerdictCard — the deterministic plan verdict.
//
//   fits      → a quiet positive: low-emphasis indigo fill, ink text, no action.
//   over cases (cut-one / multi-cut / push-deadline) → a CALM neutral heads-up:
//               sunken surface + hairline border + ink/inkSoft text (never red —
//               red is reserved for Abandon; there's no guilt here). Cut actions
//               stay ghost; the push-deadline CTA is amber — the one recommended,
//               tappable action gets the coin-edge so it reads as pressable. Amber
//               here is an action accent, not a reward or a shame cue.
//
// Action wiring (cut / push) is owned by the screen via callbacks.
// ──────────────────────────────────────────────────────────────────────────────

export function VerdictCard({
  verdict,
  deadline,
  onCut,
  onPush,
}: {
  verdict: PlanVerdict;
  deadline: number;
  onCut: (ids: string[]) => void;
  onPush: (feasibleDeadline: number) => void;
}) {
  const t = useTheme();

  // Calm neutral "heads-up" — no amber, no red.
  const noticeCard: ViewStyle = {
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
        <View style={{ gap: t.space[3] }}>
          <AppText variant="body" style={{ color: t.colors.ink }}>
            Drop{' '}
            <AppText style={{ fontWeight: t.fontWeight.bold, color: t.colors.ink }}>
              {verdict.cut.label}
            </AppText>{' '}
            and you start on time — that&apos;s {verdict.savedMin}m back.
          </AppText>
          <AppButton
            label={`Cut ${verdict.cut.label}`}
            variant="ghost"
            size="xs"
            onPress={() => onCut([verdict.cut.id])}
          />
        </View>
      </Card>
    );
  }

  if (verdict.kind === 'multi-cut') {
    const names = verdict.cuts.map((c) => c.label).join(', ');
    return (
      <Card style={noticeCard}>
        <View style={{ gap: t.space[3] }}>
          <AppText variant="body" style={{ color: t.colors.ink }}>
            A bit more than today holds. Drop {names} to start on time — saves {verdict.savedMin}m.
          </AppText>
          <AppButton
            label="Cut these"
            variant="ghost"
            size="md"
            onPress={() => onCut(verdict.cuts.map((c) => c.id))}
          />
        </View>
      </Card>
    );
  }

  // push-deadline
  return (
    <Card style={noticeCard}>
      <View style={{ gap: t.space[3] }}>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          About {verdict.overshootMin}m over. Push the finish to {formatClock(verdict.feasibleDeadline)},
          or drop a task.
        </AppText>
        <AppButton
          label={`Push finish to ${formatClock(verdict.feasibleDeadline)}`}
          variant="amber"
          size="sm"
          onPress={() => onPush(verdict.feasibleDeadline)}
        />
      </View>
    </Card>
  );
}
