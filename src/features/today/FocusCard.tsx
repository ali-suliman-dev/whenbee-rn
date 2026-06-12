import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Card } from '@/src/components/Card';
import { AppButton } from '@/src/components/AppButton';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { OptimismNudge } from './OptimismNudge';
import type { CalibrationSummary } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// FocusCard — the Today centerpiece. The honest number at the moment of
// commitment, with one primary action (Start). Raised, indigo-accented.
//
//   ● NEXT · GETTING READY        (tag row)
//   Leave for work                (task title)
//   ~28 min   you guessed 15      (honest-number row)
//   based on your last 8 times · learned on-device   (provenance)
//   [⚠ You're being optimistic again — block 28.]     (nudge, conditional)
//   Start →                       (primary CTA)
// ──────────────────────────────────────────────────────────────────────────────

interface FocusCardProps {
  categoryLabel: string;
  taskTitle: string;
  summary: CalibrationSummary;
  onStart: () => void;
}

export function FocusCard({ categoryLabel, taskTitle, summary, onStart }: FocusCardProps) {
  const t = useTheme();

  // The nudge earns its scarce amber spot only with personal evidence AND when
  // the honest number actually beats the guess — never on the prior fallback.
  const showNudge = summary.basis === 'personal' && summary.honestMinutes > summary.guessMinutes;

  const tagRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: t.colors.primary,
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };

  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };

  const numberRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space[3],
    flexWrap: 'wrap',
  };
  const guessNote: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    paddingBottom: 4,
  };
  const provenance: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Card
      raised
      radius="2xl"
      style={{
        gap: t.space[3],
        borderTopWidth: 3,
        borderTopColor: t.colors.primary,
      }}
    >
      <View style={tagRow}>
        <View style={dot} />
        <Text style={eyebrow}>NEXT · {categoryLabel.toUpperCase()}</Text>
      </View>

      <Text style={title}>{taskTitle}</Text>

      <View style={numberRow}>
        <HonestNumber size="xl" tone="indigo" value={`~${summary.honestMinutes}`} unit="min" />
        <Text style={guessNote}>you guessed {summary.guessMinutes}</Text>
      </View>

      <Text style={provenance}>{summary.label} · learned on-device</Text>

      {showNudge ? <OptimismNudge honestMin={summary.honestMinutes} /> : null}

      <AppButton label="Start →" variant="indigo" fullWidth onPress={onStart} />
    </Card>
  );
}
