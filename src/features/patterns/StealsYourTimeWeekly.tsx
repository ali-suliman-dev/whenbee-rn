import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { reasonPhrase } from '@/src/engine';
import type { ReasonInsight } from '@/src/domain/types';
import { PatternCard } from './PatternCard';

// ──────────────────────────────────────────────────────────────────────────────
// StealsYourTimeWeekly (S12, Pro) — a compact rollup of the top causes across
// categories, once there are at least two patterns to compare. One row each:
// "{category} · {cause}" on the left, the share on the right. Sibling rows share
// identical structure so the percentages line up on one right edge (CalibrationMap
// rhythm). Read straight from the user's own notes — no blame, no callout.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_ROWS = 4;

export function StealsYourTimeWeekly({ insights }: { insights: ReasonInsight[] }) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  if (insights.length < 2) return null;

  const rows = insights.slice(0, MAX_ROWS);

  const list: ViewStyle = { gap: t.space[3] };
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space[3] };
  const label: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const pctText: TextStyle = { ...(type.bigNumber as unknown as TextStyle), color: t.colors.primary };

  // dismissId: a fingerprint of the top 4 rows (categoryId + reason) so a new
  // week's top pattern (different categories/reasons) produces a new id.
  const dismissId = `steals-weekly:${rows.map((r) => `${r.categoryId}-${r.reason}`).join('|')}`;

  return (
    <PatternCard
      eyebrow={tr('stealsYourTimeWeekly.eyebrow')}
      icon="albums-outline"
      dismissLabel={tr('stealsYourTimeWeekly.dismissLabel')}
      dismissId={dismissId}
    >
      <View style={list}>
        {rows.map((r) => (
          <View key={r.categoryId} style={row}>
            <Text style={label} numberOfLines={1}>
              {r.categoryName} · {reasonPhrase(r.reason)}
            </Text>
            <Text style={pctText}>{Math.round(r.share * 100)}%</Text>
          </View>
        ))}
      </View>
    </PatternCard>
  );
}
