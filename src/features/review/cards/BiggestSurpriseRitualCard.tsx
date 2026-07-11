import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent, type TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ReviewBiggestSurprise, ConfidenceBand } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// BiggestSurpriseRitualCard — a ritual-aware version of the Patterns
// BiggestSurprise: when there is enough history (≥5 logs) it plots the week's
// outlier on the user's own 80% confidence band using ONLY measured numbers —
// the band low/high, the guess (a ghostly dotted marker) and the real value (a
// solid honey dot on the track). Nothing is fabricated. Falls back to a plain
// two-number compare when the band isn't earned yet.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  surprise: ReviewBiggestSurprise;
  band: ConfidenceBand | null;
  loggedCount: number;
}

/** Minimum separation (in % of the track) between the guess and real FLAG
 *  labels before they're nudged apart so the text never overlaps. The markers
 *  themselves (caret, dot, guide) always stay on their true value positions. */
const FLAG_MIN_GAP_PCT = 18;

const clampPct = (v: number) => Math.min(Math.max(v, 4), 96);

export function BiggestSurpriseRitualCard({ surprise, band, loggedCount }: Props) {
  const t = useTheme();
  const rv = t.reviewViz;

  // Flag labels are centered on their value via translateX(-width/2). RN
  // transforms don't take percentages, so each flag is measured on layout and
  // held at opacity 0 until its width is known (no left-anchored first-frame
  // flash). Hooks are declared before the `!band` early return so hook order is
  // stable across renders.
  const [guessFlagW, setGuessFlagW] = useState(0);
  const [realFlagW, setRealFlagW] = useState(0);
  const onGuessFlagLayout = useCallback((e: LayoutChangeEvent) => {
    setGuessFlagW(e.nativeEvent.layout.width);
  }, []);
  const onRealFlagLayout = useCallback((e: LayoutChangeEvent) => {
    setRealFlagW(e.nativeEvent.layout.width);
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
    // Fallback (thin history) — a plain two-number compare. Both numbers are
    // real (guess vs real), sized in proportion; neutral base, honey on real.
    fallbackRow: { flexDirection: 'row', gap: t.space[2] },
    fallbackBar: {
      flex: 1,
      height: rv.bandFallbackBarH,
      borderRadius: t.radii.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fallbackGuessBar: { backgroundColor: t.colors.surfaceSunken },
    fallbackRealBar: { backgroundColor: t.colors.accent },
    fallbackGuessLabel: { ...type.caption, color: t.colors.inkSoft },
    fallbackRealLabel: { ...type.captionBold, color: t.colors.onAmber },
    // Breathing room above/below the range illustration so it isn't pinned
    // tight between the heading and the readout. Own padding (not a sibling
    // margin) keeps the card on one gap-based rhythm.
    vizBlock: { paddingVertical: t.space[2], gap: t.space[2] },
    // Real-values range band
    band: { height: rv.bandHeight, position: 'relative' },
    flag: { ...(type.numMicro as unknown as TextStyle), position: 'absolute', top: 0 },
    flagGuess: { color: t.colors.inkFaint },
    flagReal: { color: t.colors.amberText },
    caret: {
      position: 'absolute',
      top: rv.bandCaretTop,
      width: 0,
      height: 0,
      borderLeftWidth: rv.bandCaretW,
      borderRightWidth: rv.bandCaretW,
      borderTopWidth: rv.bandCaretH,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: t.colors.inkSoft,
    },
    guide: { position: 'absolute', top: rv.bandGuideTop, left: 0, right: 0 },
    track: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: rv.bandTrackTop,
      height: rv.bandTrackH,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.surfaceSunken,
    },
    dot: {
      position: 'absolute',
      top: rv.bandDotTop,
      width: rv.bandDotSize,
      height: rv.bandDotSize,
      borderRadius: t.radii.full,
      backgroundColor: t.colors.accent,
      borderWidth: rv.bandDotBorder,
      borderColor: t.colors.surface,
    },
    axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
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
  const guessPct = range > 0 ? clampPct(((surprise.estimateMin - band.lowMin) / range) * 100) : 50;
  const realPct = range > 0 ? clampPct(((surprise.actualMin - band.lowMin) / range) * 100) : 50;

  // Flag anchors follow the true values, nudged apart only when the labels
  // would collide. The markers (caret/dot/guide) keep the true pcts.
  let guessFlagPct = guessPct;
  let realFlagPct = realPct;
  if (Math.abs(realPct - guessPct) < FLAG_MIN_GAP_PCT) {
    const mid = (guessPct + realPct) / 2;
    const half = FLAG_MIN_GAP_PCT / 2;
    const guessIsLeft = guessPct <= realPct;
    guessFlagPct = clampPct(mid + (guessIsLeft ? -half : half));
    realFlagPct = clampPct(mid + (guessIsLeft ? half : -half));
  }

  const guideHeight = rv.bandTrackTop + rv.bandTrackH - rv.bandGuideTop;
  const insideRange = surprise.actualMin >= band.lowMin && surprise.actualMin <= band.highMin;

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

        <View style={styles.vizBlock}>
          <View style={styles.band}>
            <Text
              onLayout={onGuessFlagLayout}
              style={[
                styles.flag,
                styles.flagGuess,
                {
                  left: `${guessFlagPct}%`,
                  transform: [{ translateX: -guessFlagW / 2 }],
                  opacity: guessFlagW > 0 ? 1 : 0,
                },
              ]}
            >
              {surprise.estimateMin}m guess
            </Text>
            <Text
              onLayout={onRealFlagLayout}
              style={[
                styles.flag,
                styles.flagReal,
                {
                  left: `${realFlagPct}%`,
                  transform: [{ translateX: -realFlagW / 2 }],
                  opacity: realFlagW > 0 ? 1 : 0,
                },
              ]}
            >
              {surprise.actualMin}m real
            </Text>
            <View
              style={[
                styles.caret,
                { left: `${guessPct}%`, transform: [{ translateX: -rv.bandCaretW }] },
              ]}
            />
            <View style={styles.track} />
            <Svg width="100%" height={guideHeight} style={styles.guide}>
              <Line
                x1={`${guessPct}%`}
                y1={0}
                x2={`${guessPct}%`}
                y2={guideHeight}
                stroke={t.colors.inkFaint}
                strokeWidth={rv.bandGuideW}
                strokeDasharray={rv.bandGuideDash}
              />
            </Svg>
            <View
              style={[
                styles.dot,
                { left: `${realPct}%`, transform: [{ translateX: -rv.bandDotSize / 2 }] },
              ]}
            />
          </View>

          <View style={styles.axisRow}>
            <Text style={styles.axisLabel}>{band.lowMin}m</Text>
            <Text style={styles.axisLabel}>{band.highMin}m</Text>
          </View>
        </View>

        <Text style={styles.desc}>
          {'Your real '}
          <Text style={styles.descInk}>{surprise.categoryName}</Text>
          {' time lands '}
          <Text style={styles.descAmber}>
            {band.lowMin}–{band.highMin}m
          </Text>
          {' 80% of the time — it came in at '}
          <Text style={styles.descAmber}>{surprise.actualMin}m</Text>
          {`, past your ${surprise.estimateMin}m guess`}
          {insideRange ? ' but inside your range.' : ', beyond your usual range.'}
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
