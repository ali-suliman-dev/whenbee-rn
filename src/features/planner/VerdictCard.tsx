import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Card } from '@/src/components/Card';
import { formatClock } from '@/src/lib/time';
import type { PlanVerdict } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// VerdictCard — the deterministic "cut one" verdict, framed kind + amber, NEVER
// red. `fits` is a calm indigo confirm; the over cases (`cut-one`/`multi-cut`/
// `push-deadline`) wear an amber tint with no-guilt wording and a single action.
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

  const amberCard = {
    backgroundColor: t.colors.accentTint,
    borderColor: t.colors.accentEdge,
  };

  if (verdict.kind === 'fits') {
    return (
      <Card style={{ backgroundColor: t.colors.primaryTint, borderColor: t.colors.primary }}>
        <AppText variant="body" style={{ color: t.colors.ink }}>
          This fits. Start on time and you&apos;ll finish by {formatClock(deadline)}.
        </AppText>
      </Card>
    );
  }

  if (verdict.kind === 'cut-one') {
    return (
      <Card style={amberCard}>
        <View style={{ gap: t.space[3] }}>
          <AppText variant="body" style={{ color: t.colors.amberText }}>
            Cut <AppText style={{ fontWeight: t.fontWeight.bold, color: t.colors.amberText }}>{verdict.cut.label}</AppText> to start on
            time — that buys back {verdict.savedMin}m.
          </AppText>
          <AppButton
            label={`Cut ${verdict.cut.label}`}
            variant="amber"
            onPress={() => onCut([verdict.cut.id])}
          />
        </View>
      </Card>
    );
  }

  if (verdict.kind === 'multi-cut') {
    const names = verdict.cuts.map((c) => c.label).join(', ');
    return (
      <Card style={amberCard}>
        <View style={{ gap: t.space[3] }}>
          <AppText variant="body" style={{ color: t.colors.amberText }}>
            A few more than today has room for. Cutting {names} starts you on time and saves{' '}
            {verdict.savedMin}m.
          </AppText>
          <AppButton
            label="Cut these"
            variant="amber"
            onPress={() => onCut(verdict.cuts.map((c) => c.id))}
          />
        </View>
      </Card>
    );
  }

  // push-deadline
  return (
    <Card style={amberCard}>
      <View style={{ gap: t.space[3] }}>
        <AppText variant="body" style={{ color: t.colors.amberText }}>
          Won&apos;t fit by {formatClock(deadline)} — finish by{' '}
          {formatClock(verdict.feasibleDeadline)} or cut tasks. (About {verdict.overshootMin}m over.)
        </AppText>
        <AppButton
          label={`Push finish to ${formatClock(verdict.feasibleDeadline)}`}
          variant="amber"
          onPress={() => onPush(verdict.feasibleDeadline)}
        />
      </View>
    </Card>
  );
}
