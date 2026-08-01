import { Text, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// ReflectionCard — the closing question. One quiet, open prompt (deterministic by
// period id), italic and unhurried. No answer field, no commitment — just a pause
// before you close the recap.
// ──────────────────────────────────────────────────────────────────────────────

export function ReflectionCard({ question }: { question: string }) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const prompt: TextStyle = {
    ...(type.body as unknown as TextStyle),
    color: t.colors.inkSoft,
    fontStyle: 'italic',
  };
  return (
    <Card tone="flat" style={{ gap: t.space[2] }}>
      <Text style={eyebrow}>{tt('reflection.eyebrow')}</Text>
      <Text style={prompt}>{question}</Text>
    </Card>
  );
}
