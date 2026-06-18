import { useEffect, useState } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { formatReclaim } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// ReclaimEndowment — the paywall's lead: the user's OWN earned number. Reclaim is
// the honest time their calibration already spared them (05c), a bank that only
// grows. Leading the upgrade with it reframes Pro from "buy a feature" to "put the
// time you already earned to work on your real calendar" — the endowment.
//
// Honest by construction: it renders ONLY a real, loaded total > 0. A brand-new
// user (or any load failure) sees nothing here — we never fabricate a number.
// ──────────────────────────────────────────────────────────────────────────────

interface ReclaimSummaryRead {
  lifetimeMin: number;
  honestLogCount: number;
}

/** Three honeycomb cells, the bottom one sealed amber — the "banked honey" motif. */
function HoneyComb({ size, line, fill }: { size: number; line: string; fill: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Polygon points="22,5 33,11.5 33,24.5 22,31 11,24.5 11,11.5" fill="none" stroke={line} strokeWidth={1.5} />
      <Polygon points="44,5 55,11.5 55,24.5 44,31 33,24.5 33,11.5" fill="none" stroke={line} strokeWidth={1.5} />
      <Polygon points="33,26 44,32.5 44,45.5 33,52 22,45.5 22,32.5" fill={fill} />
    </Svg>
  );
}

export function ReclaimEndowment() {
  const t = useTheme();
  const loadReclaimSummary = useCalibrationStore((s) => s.loadReclaimSummary);
  const [summary, setSummary] = useState<ReclaimSummaryRead | null>(null);

  useEffect(() => {
    let active = true;
    void loadReclaimSummary()
      .then((s) => {
        if (active) setSummary({ lifetimeMin: s.lifetimeMin, honestLogCount: s.honestLogCount });
      })
      .catch(() => {
        // A paywall must never crash on a data read — stay hidden if it fails.
      });
    return () => {
      active = false;
    };
  }, [loadReclaimSummary]);

  // Honest by construction: nothing to show until a real, positive total loads.
  if (!summary || summary.lifetimeMin <= 0) return null;

  const card: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    borderWidth: t.borderWidth.thin,
    borderColor: t.colors.accentSoft,
    padding: t.space[5],
    gap: t.space[2],
    overflow: 'hidden',
  };
  const comb: ViewStyle = { position: 'absolute', right: t.space[4], top: t.space[4] };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const dot: ViewStyle = { width: 7, height: 7, borderRadius: t.radii.full, backgroundColor: t.colors.accent };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const number: TextStyle = {
    ...(type.honestNumberXl as unknown as TextStyle),
    color: t.colors.accent,
  };
  const provenance: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    maxWidth: '78%',
  };
  const provStrong: TextStyle = { color: t.colors.ink };

  const logs = `${summary.honestLogCount} honest ${summary.honestLogCount === 1 ? 'log' : 'logs'}`;

  return (
    <View style={card}>
      <View style={comb}>
        <HoneyComb size={t.upsell.comb} line={t.colors.accentEdge} fill={t.colors.accent} />
      </View>
      <View style={eyebrowRow}>
        <View style={dot} />
        <Text style={eyebrow}>You’ve already reclaimed</Text>
      </View>
      <Text style={number}>{formatReclaim(summary.lifetimeMin)}</Text>
      <Text style={provenance}>
        <Text style={provStrong}>from {logs}, on your phone.</Text> Pro puts that to work on your real calendar.
      </Text>
    </View>
  );
}
