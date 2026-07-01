import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ReviewBiggestSurprise, ConfidenceBand } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// BiggestSurpriseRitualCard — replaces the bare Patterns BiggestSurprise with a
// ritual-aware version: when there is enough history (≥5 logs) it plots the
// week's outlier as a small distribution histogram across the user's own 80%
// confidence band, with a dotted guess marker anchored on the time axis. Falls
// back to a simple two-bar layout when the band isn't earned yet.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  surprise: ReviewBiggestSurprise;
  band: ConfidenceBand | null;
  loggedCount: number;
}

/** Bin count for the illustrative distribution shape. Not real per-bin log
 *  counts (the domain model only gives us the band + one outlier), so the
 *  shape is a deterministic decay from the bin holding the real value — it
 *  conveys "your time clusters near here", not a literal frequency count. */
const HIST_BINS = 6;

export function BiggestSurpriseRitualCard({ surprise, band, loggedCount }: Props) {
  const t = useTheme();
  const rv = t.reviewViz;

  // The guess flag centers over guessPct — measured on layout, since RN
  // transforms don't support percentage translateX (see ForwardActionCard's
  // overflow caption for the same technique). Hoisted above the `!band` early
  // return so hook order never changes between renders.
  const [flagWidth, setFlagWidth] = useState(0);
  const onFlagLayout = useCallback((e: LayoutChangeEvent) => {
    setFlagWidth(e.nativeEvent.layout.width);
  }, []);

  const ratio =
    surprise.estimateMin > 0 ? (surprise.actualMin / surprise.estimateMin).toFixed(1) : '—';

  const styles = StyleSheet.create({
    container: { gap: t.space[3] },
    headerGroup: { gap: t.space[1] },
    eyebrow: { ...type.eyebrow, color: t.colors.inkSoft },
    heading: { ...type.body, color: t.colors.inkSoft },
    categoryName: { fontFamily: 'Jakarta-ExtraBold', color: t.colors.ink },
    desc: { ...type.bodySm, color: t.colors.inkSoft },
    descInk: { fontFamily: 'Jakarta-ExtraBold', color: t.colors.ink },
    descAmber: { ...type.bodySmBold, color: t.colors.amberText },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    chip: {
      backgroundColor: t.colors.accentChip,
      borderRadius: t.radii.sm,
      paddingHorizontal: t.space[2],
      paddingVertical: t.space[1],
    },
    chipText: { ...type.caption, color: t.colors.inkSoft },
    chipRatio: { ...(type.numCaption as unknown as TextStyle), color: t.colors.amberText },
    logCount: { ...type.caption, color: t.colors.inkFaint },
    logCountNum: { ...(type.numCaption as unknown as TextStyle), color: t.colors.inkFaint },
    // Fallback (thin history) layout — a plain two-bar guess/real compare.
    fallbackRow: { flexDirection: 'row', gap: t.space[2] },
    fallbackBar: {
      flex: 1,
      height: rv.histBarHeight,
      borderRadius: t.radii.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fallbackGuessBar: { backgroundColor: t.colors.nightSoft },
    fallbackRealBar: { backgroundColor: t.colors.accent },
    fallbackGuessLabel: { ...type.caption, color: t.colors.inkSoft },
    fallbackRealLabel: { ...type.captionBold, color: t.colors.onAmber },
    histBlock: { paddingTop: rv.histTopPad, position: 'relative' },
    flag: { ...(type.numMicro as unknown as TextStyle), position: 'absolute', top: 0, color: t.colors.inkFaint },
    caret: {
      position: 'absolute',
      top: rv.histCaretTop,
      width: 0,
      height: 0,
      borderLeftWidth: rv.histCaretW,
      borderRightWidth: rv.histCaretW,
      borderTopWidth: rv.histCaretH,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: t.colors.inkSoft,
    },
    guide: { position: 'absolute', top: rv.histGuideTop, left: 0, right: 0 },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: t.space[1.5],
      height: rv.histBarHeight,
    },
    barWrap: { flex: 1 },
    bar: {
      width: '100%',
      borderTopLeftRadius: rv.histBarRadius,
      borderTopRightRadius: rv.histBarRadius,
      backgroundColor: t.colors.nightSoft,
    },
    barHot: { backgroundColor: t.colors.accent },
    axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[3] },
    axisLabel: { ...(type.numMicro as unknown as TextStyle), color: t.colors.inkFaint },
  });

  if (!band) {
    const total = surprise.estimateMin + surprise.actualMin;
    const guessFlex = total > 0 ? surprise.estimateMin / total : 0.5;
    const realFlex = total > 0 ? surprise.actualMin / total : 0.5;
    return (
      <Card tone="flat">
        <View style={styles.container}>
          <View style={styles.headerGroup}>
            <Text style={styles.eyebrow}>YOUR BIGGEST SURPRISE</Text>
            <Text style={styles.heading}>
              <Text style={styles.categoryName}>{surprise.categoryName}</Text>
              {' — biggest drift this week'}
            </Text>
          </View>
          <View style={styles.fallbackRow}>
            <View style={[styles.fallbackBar, styles.fallbackGuessBar, { flex: guessFlex }]}>
              <Text style={styles.fallbackGuessLabel} numberOfLines={1}>
                {surprise.estimateMin}m guess
              </Text>
            </View>
            <View style={[styles.fallbackBar, styles.fallbackRealBar, { flex: realFlex }]}>
              <Text style={styles.fallbackRealLabel} numberOfLines={1}>
                {surprise.actualMin}m real
              </Text>
            </View>
          </View>
          <View style={styles.bottomRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                <Text style={styles.chipRatio}>{ratio}×</Text>
                {' your read'}
              </Text>
            </View>
            <Text style={styles.logCount}>
              <Text style={styles.logCountNum}>{loggedCount}</Text>
              {' logs'}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const range = band.highMin - band.lowMin;
  const clampPct = (v: number) => Math.min(Math.max(v, 4), 96);
  const guessPct = range > 0 ? clampPct(((surprise.estimateMin - band.lowMin) / range) * 100) : 50;
  const realPct =
    range > 0 ? Math.min(Math.max(((surprise.actualMin - band.lowMin) / range) * 100, 0), 100) : 50;
  const hotBinIndex = Math.min(Math.max(Math.floor((realPct / 100) * HIST_BINS), 0), HIST_BINS - 1);

  const bins = Array.from({ length: HIST_BINS }, (_, i) => {
    const distance = Math.abs(i - hotBinIndex);
    const heightFrac = Math.max(0.22, 1 - distance * 0.22);
    return { isHot: i === hotBinIndex, height: heightFrac * rv.histBarHeight };
  });

  const guideHeight = rv.histTopPad + rv.histBarHeight - rv.histGuideTop;

  return (
    <Card tone="flat">
      <View style={styles.container}>
        <View style={styles.headerGroup}>
          <Text style={styles.eyebrow}>YOUR BIGGEST SURPRISE</Text>
          <Text style={styles.heading}>
            <Text style={styles.categoryName}>{surprise.categoryName}</Text>
            {' — biggest drift this week'}
          </Text>
        </View>

        <View style={styles.histBlock}>
          <Text
            onLayout={onFlagLayout}
            style={[
              styles.flag,
              { left: `${guessPct}%`, transform: [{ translateX: -flagWidth / 2 }] },
            ]}
          >
            {surprise.estimateMin}m guess
          </Text>
          <View
            style={[
              styles.caret,
              { left: `${guessPct}%`, transform: [{ translateX: -rv.histCaretW }] },
            ]}
          />
          <Svg width="100%" height={guideHeight} style={styles.guide}>
            <Line
              x1={`${guessPct}%`}
              y1={0}
              x2={`${guessPct}%`}
              y2={guideHeight}
              stroke={t.colors.inkFaint}
              strokeWidth={rv.histDotW}
              strokeDasharray={rv.histDotDash}
            />
          </Svg>
          <View style={styles.barsRow}>
            {bins.map((bin, i) => (
              <View key={i} style={styles.barWrap}>
                <View style={[styles.bar, bin.isHot && styles.barHot, { height: bin.height }]} />
              </View>
            ))}
          </View>
          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>{band.lowMin}m</Text>
            <Text style={styles.axisLabel}>{band.highMin}m</Text>
          </View>
        </View>

        <Text style={styles.desc}>
          {'Your real '}
          <Text style={styles.descInk}>{surprise.categoryName}</Text>
          {' time piles up near '}
          <Text style={styles.descAmber}>{surprise.actualMin}m</Text>
          {' — past your '}
          {surprise.estimateMin}
          {'m guess, inside your '}
          <Text style={styles.descAmber}>
            {band.lowMin}–{band.highMin}m
          </Text>
          {' range.'}
        </Text>

        <View style={styles.bottomRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>
              <Text style={styles.chipRatio}>{ratio}×</Text>
              {' your read'}
            </Text>
          </View>
          <Text style={styles.logCount}>
            <Text style={styles.logCountNum}>{loggedCount}</Text>
            {' logs'}
          </Text>
        </View>
      </View>
    </Card>
  );
}
