import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { BeforeAfterHero } from './BeforeAfterHero';
import type { ProofKind } from './paywallCopy';

// ──────────────────────────────────────────────────────────────────────────────
// TopProof — the small "show, don't tell" visual under the headline, chosen by the
// gate. calendar → the existing before/after day columns. coach / insight → a calm
// mini bar panel with a one-line outcome. none → nothing (headline + stack carry it).
// ──────────────────────────────────────────────────────────────────────────────

function MiniBars({ caption }: { caption: string }) {
  const t = useTheme();
  const bars = [
    { h: 0.6, c: t.colors.inkFaint },
    { h: 0.82, c: t.colors.inkFaint },
    { h: 0.5, c: t.colors.primary },
    { h: 0.4, c: t.colors.primary },
    { h: 0.34, c: t.colors.accent },
  ];
  const wrap: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[2], height: t.space[12] };
  const cap: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.amberText, fontFamily: 'Jakarta-Bold', marginTop: t.space[2] };
  return (
    <Card tone="raised" style={{ gap: t.space[1] }}>
      <View style={wrap}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={{ flex: 1, height: `${b.h * 100}%`, backgroundColor: b.c, borderRadius: t.radii.sm, borderCurve: 'continuous' }}
          />
        ))}
      </View>
      <Text style={cap}>{caption}</Text>
    </Card>
  );
}

export function TopProof({ kind }: { kind: ProofKind }) {
  const { t } = useTranslation('paywall');
  if (kind === 'calendar') return <BeforeAfterHero />;
  if (kind === 'coach') return <MiniBars caption={t('topProof.coachCaption')} />;
  if (kind === 'insight') return <MiniBars caption={t('topProof.insightCaption')} />;
  return null;
}
