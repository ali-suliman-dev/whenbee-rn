import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// AccuracyReadCard — "how your guesses landed". A verbal read, never a bare score
// (a number invites a verdict; no-guilt forbids it). The optional sharpest-window
// phrase rides underneath when the accuracy correlations earned one. Hidden by the
// modal when there is no line to show.
// ──────────────────────────────────────────────────────────────────────────────

export function AccuracyReadCard({
  line,
  sharpestPhrase,
}: {
  line: string;
  sharpestPhrase: string | null;
}) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const headline: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const detail: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const block: ViewStyle = { gap: t.space[2] };

  return (
    <Card tone="flat" style={{ gap: t.space[3] }}>
      <Text style={eyebrow}>{tt('accuracyRead.eyebrow')}</Text>
      <View style={block}>
        <Text style={headline}>{line}</Text>
        {sharpestPhrase ? <Text style={detail}>{sharpestPhrase}</Text> : null}
      </View>
    </Card>
  );
}
