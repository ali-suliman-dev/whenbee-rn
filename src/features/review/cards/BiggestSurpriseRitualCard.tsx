import { View, Text, StyleSheet, Platform } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import type { ReviewBiggestSurprise, ConfidenceBand } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// BiggestSurpriseRitualCard — replaces the bare Patterns BiggestSurprise with a
// ritual-aware version: when there is enough history (≥5 logs) it overlays the
// guess + actual onto an 80% confidence band so the user sees how this week's
// outlier compares to their own past range. Falls back to a simple two-bar
// layout when the band isn't earned yet.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  surprise: ReviewBiggestSurprise;
  band: ConfidenceBand | null;
  loggedCount: number;
}

export function BiggestSurpriseRitualCard({ surprise, band, loggedCount }: Props) {
  const t = useTheme();
  const { t: tt } = useTranslation('review');

  const ratio =
    surprise.estimateMin > 0 ? (surprise.actualMin / surprise.estimateMin).toFixed(1) : '—';

  const styles = StyleSheet.create({
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.inkFaint,
      letterSpacing: 1.2,
      marginBottom: t.space[1],
    },
    heading: { fontSize: 15, color: t.colors.inkSoft, marginBottom: t.space[3] },
    categoryName: { fontWeight: '700', color: t.colors.ink },
    fallbackRow: { flexDirection: 'row', gap: t.space[2], marginBottom: t.space[3] },
    fallbackBar: {
      flex: 1,
      height: 40,
      borderRadius: t.radii.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fallbackLabel: { fontSize: 12, fontWeight: '700' },
    bandContainer: { height: 58, marginBottom: t.space[3], position: 'relative' },
    rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    rangeLabel: { fontSize: 10, color: t.colors.inkFaint, fontWeight: '600' },
    pill: {
      position: 'absolute',
      top: 14,
      left: 0,
      right: 0,
      height: 28,
      borderRadius: t.radii.sm,
      backgroundColor: 'rgba(238,174,77,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(238,174,77,0.14)',
    },
    description: { fontSize: 13, color: t.colors.inkSoft, marginBottom: t.space[3] },
    amberInline: { color: t.colors.amberText, fontWeight: '700' },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    chip: {
      backgroundColor: 'rgba(238,174,77,0.15)',
      borderRadius: t.radii.sm,
      paddingHorizontal: t.space[2],
      paddingVertical: 4,
    },
    chipText: { fontSize: 13, color: t.colors.amberText, fontWeight: '700' },
    logCount: { fontSize: 11, color: t.colors.inkFaint },
  });

  if (!band) {
    // Fallback: simple two-bar layout when history is thin
    const total = surprise.estimateMin + surprise.actualMin;
    const guessFlex = total > 0 ? surprise.estimateMin / total : 0.5;
    const realFlex = total > 0 ? surprise.actualMin / total : 0.5;
    return (
      <Card tone="flat">
        <Text style={styles.eyebrow}>{tt('biggestSurprise.eyebrow')}</Text>
        <Text style={styles.heading}>
          <Text style={styles.categoryName}>{surprise.categoryName}</Text>
          {tt('biggestSurprise.headingSuffix')}
        </Text>
        <View style={styles.fallbackRow}>
          <View
            style={[
              styles.fallbackBar,
              { flex: guessFlex, backgroundColor: 'rgba(255,255,255,0.10)' },
            ]}
          >
            <Text style={[styles.fallbackLabel, { color: t.colors.inkSoft }]}>
              {tt('biggestSurprise.guessLabel', { min: surprise.estimateMin })}
            </Text>
          </View>
          <View
            style={[
              styles.fallbackBar,
              { flex: realFlex, backgroundColor: 'rgba(238,174,77,0.22)' },
            ]}
          >
            <Text style={[styles.fallbackLabel, { color: t.colors.amberText }]}>
              {tt('biggestSurprise.realLabel', { min: surprise.actualMin })}
            </Text>
          </View>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{tt('biggestSurprise.ratioChip', { ratio })}</Text>
          </View>
          <Text style={styles.logCount}>{tt('biggestSurprise.logCount', { count: loggedCount })}</Text>
        </View>
      </Card>
    );
  }

  // Band viz — overlay guess tick + real dot on the 10th–90th percentile range
  const range = band.highMin - band.lowMin;
  const clamp = (v: number) => Math.min(Math.max(v, 5), 95);
  const guessPct = range > 0 ? clamp(((surprise.estimateMin - band.lowMin) / range) * 100) : 50;
  const realPct = range > 0 ? clamp(((surprise.actualMin - band.lowMin) / range) * 100) : 50;

  const insideRange = surprise.estimateMin >= band.lowMin && surprise.estimateMin <= band.highMin;
  const descSuffix = tt(insideRange ? 'biggestSurprise.suffixInside' : 'biggestSurprise.suffixOutside');

  return (
    <Card tone="flat">
      <Text style={styles.eyebrow}>{tt('biggestSurprise.eyebrow')}</Text>
      <Text style={styles.heading}>
        <Text style={styles.categoryName}>{surprise.categoryName}</Text>
        {tt('biggestSurprise.headingSuffix')}
      </Text>
      <View style={styles.bandContainer}>
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>{tt('biggestSurprise.minutesLabel', { min: band.lowMin })}</Text>
          <Text style={styles.rangeLabel}>{tt('biggestSurprise.minutesLabel', { min: band.highMin })}</Text>
        </View>
        <View style={styles.pill} />
        {/* Guess tick */}
        <View
          style={{
            position: 'absolute',
            top: 14,
            height: 28,
            width: 2,
            backgroundColor: 'rgba(255,255,255,0.28)',
            left: `${guessPct}%` as `${number}%`,
          }}
        />
        {/* Real dot */}
        <View
          style={{
            position: 'absolute',
            top: 14 + (28 - 20) / 2,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: t.colors.accent,
            left: `${realPct}%` as `${number}%`,
            transform: [{ translateX: -10 }],
            ...Platform.select({
              ios: {
                shadowColor: t.colors.accent,
                shadowOpacity: 0.5,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
              },
              android: { elevation: 4 },
            }),
          }}
        />
        {/* Labels below the band */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <Text
            style={{
              position: 'absolute',
              left: `${guessPct}%` as `${number}%`,
              fontSize: 9,
              color: t.colors.inkFaint,
              fontWeight: '700',
              transform: [{ translateX: -20 }],
            }}
          >
            {tt('biggestSurprise.guessLabel', { min: surprise.estimateMin })}
          </Text>
          <Text
            style={{
              position: 'absolute',
              left: `${realPct}%` as `${number}%`,
              fontSize: 9,
              color: t.colors.amberText,
              fontWeight: '700',
              transform: [{ translateX: -15 }],
            }}
          >
            {tt('biggestSurprise.realLabel', { min: surprise.actualMin })}
          </Text>
        </View>
      </View>
      <Text style={styles.description}>
        <Trans
          t={tt}
          i18nKey="biggestSurprise.description"
          values={{ category: surprise.categoryName, low: band.lowMin, high: band.highMin }}
          components={[
            <Text key="0" style={{ color: t.colors.ink }} />,
            <Text key="1" style={styles.amberInline} />,
          ]}
        />
        {descSuffix}
      </Text>
      <View style={styles.bottomRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{tt('biggestSurprise.ratioChip', { ratio })}</Text>
        </View>
        <Text style={styles.logCount}>{tt('biggestSurprise.logCount', { count: loggedCount })}</Text>
      </View>
    </Card>
  );
}
