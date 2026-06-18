import { View, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { formatClock } from '@/src/lib/time';
import type { ReprojectResult } from '@/src/engine/planner';
import type { usePlanner } from './usePlanner';

// ──────────────────────────────────────────────────────────────────────────────
// CutCard — amber triage card shown when re-project comes back over budget.
//
// Renders only when `cut` is set (i.e. `!cut.stillFits`). Uses amber/accentSoft
// throughout — NEVER red. Red is exclusively for the Abandon destructive action.
//
// Tone: triage, never verdict. "Here's what still fits" not "you overcommitted".
// The user makes the explicit choice: accept the suggested cut, push the finish
// time, or dismiss and carry on.
// ──────────────────────────────────────────────────────────────────────────────

type PlannerHandle = ReturnType<typeof usePlanner>;

interface CutCardProps {
  cut: ReprojectResult;
  acceptCut: PlannerHandle['acceptCut'];
  dismissCut: PlannerHandle['dismissCut'];
  pushDeadline: PlannerHandle['pushDeadline'];
}

export function CutCard({ cut, acceptCut, dismissCut, pushDeadline }: CutCardProps) {
  const t = useTheme();
  const { verdict } = cut;

  // ── Derive triage copy from verdict kind ────────────────────────────────────

  // Derive per-verdict fields — only use the field the verdict actually carries.
  // cut-one/multi-cut carry savedMin (minutes freed by the cut), NOT an overshoot
  // figure — so we never display a "N over" number for those variants.
  let cutLabel = '';
  let feasibleFinish: number | null = null;
  // push-deadline is the only variant with a real, correct overshoot number.
  let overshootMin: number | null = null;

  if (verdict.kind === 'cut-one') {
    cutLabel = verdict.cut.label;
  } else if (verdict.kind === 'multi-cut') {
    cutLabel = verdict.cuts.map((c) => c.label).join(' + ');
  } else if (verdict.kind === 'push-deadline') {
    overshootMin = verdict.overshootMin;
    feasibleFinish = verdict.feasibleDeadline;
  }

  // Friendly rounded overshoot — only used for push-deadline.
  const roundedOver =
    overshootMin !== null ? Math.max(1, Math.round(overshootMin / 5) * 5) : null;

  // The finish time the cut would unlock (from the verdict's startBy).
  const fitsBy =
    verdict.kind === 'cut-one' || verdict.kind === 'multi-cut'
      ? verdict.startBy
      : null;

  // ── Styles (amber throughout — no red) ──────────────────────────────────────

  const card: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[3],
    borderWidth: t.borderWidth.card,
    borderColor: t.colors.accentEdge,
  };

  const eyebrow: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.amberText,
    letterSpacing: t.letterSpacing.tight,
  };

  const situation: TextStyle = {
    fontSize: t.fontSize.base,
    color: t.colors.ink,
    lineHeight: t.fontSize.base * t.lineHeight.normal,
  };

  const bold: TextStyle = {
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
  };

  const actions: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space[2],
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={card}>
      {/* ── Eyebrow label ── */}
      <AppText style={eyebrow}>HEADS UP</AppText>

      {/* ── Situation copy — triage, never verdict ── */}
      {verdict.kind === 'cut-one' || verdict.kind === 'multi-cut' ? (
        <AppText style={situation}>
          {"Doesn't all fit. Drop "}
          <AppText style={[situation, bold]}>{cutLabel}</AppText>
          {fitsBy !== null
            ? ` → done by ${formatClock(fitsBy)} ✓`
            : '.'}
        </AppText>
      ) : (
        <AppText style={situation}>
          {'About '}
          <AppText style={[situation, bold]}>
            {roundedOver !== null ? `${roundedOver}m` : '—'}
          </AppText>
          {' over. The earliest everything fits is '}
          <AppText style={[situation, bold]}>
            {feasibleFinish !== null ? formatClock(feasibleFinish) : '—'}
          </AppText>
          {'.'}
        </AppText>
      )}

      {/* ── Action buttons ── */}
      <View style={actions}>
        {(verdict.kind === 'cut-one' || verdict.kind === 'multi-cut') ? (
          <AppButton
            label="Drop it"
            variant="amber"
            size="sm"
            onPress={acceptCut}
          />
        ) : null}

        {verdict.kind === 'push-deadline' && feasibleFinish !== null ? (
          <AppButton
            label={`Finish at ${formatClock(feasibleFinish)}`}
            variant="amber"
            size="sm"
            onPress={() => pushDeadline(feasibleFinish)}
          />
        ) : null}

        <AppButton
          label="Carry on"
          variant="ghost"
          size="sm"
          onPress={dismissCut}
        />
      </View>
    </View>
  );
}
