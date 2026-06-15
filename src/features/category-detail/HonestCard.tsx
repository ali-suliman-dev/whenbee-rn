import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { HonestNumber } from '@/src/components/HonestNumber';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestCard — the hero of the category screen: the one number that matters,
// with its ripeness + learning progress folded in so the top is a single, clear
// focal block (most-important-first).
//
//   [Raw]  1 log · 10 to Setting          (tier badge + progress, amber = honey)
//   🔍 Your honest number
//   ~28 min   runs 2.0×                   (huge indigo + quiet multiplier)
//   based on typical patterns · learned on-device
// ──────────────────────────────────────────────────────────────────────────────

interface HonestCardProps {
  categoryName: string;
  honestMinutes: number;
  multiplier: number;
  provenance: string;
  /** Ripeness tier (e.g. "Raw"). When present, renders the tier+progress header. */
  tier?: string;
  n?: number;
  logsToNext?: number;
  nextTier?: string | null;
  /** Earned-Readiness axis. Below 'honest' the card shows a range, not a point. */
  confidence?: CalibrationConfidence;
  /** The honest band shown while still learning. Null once honest (a point). */
  range?: HonestRange | null;
  /** Pro-only, display-only B15 note naming the dominant over-run cause. Never
   *  affects the honest number or multiplier — purely a quiet second provenance line. */
  reasonNote?: string;
}

// While the model is still learning, the honest number is a band, not a point.
// The line under it names where it's at without ever reading as a shortfall.
const LEARNING_LINE: Record<Exclude<CalibrationConfidence, 'honest'>, string> = {
  raw: 'Still learning your pace. Every run you log narrows this range.',
  setting: 'Getting clearer. A few more runs and this lands on one honest number.',
};

export function HonestCard({
  categoryName,
  honestMinutes,
  multiplier,
  provenance,
  tier,
  n,
  logsToNext,
  nextTier,
  confidence,
  range,
  reasonNote,
}: HonestCardProps) {
  const t = useTheme();
  // Show the band only while learning AND we actually have a range to show;
  // anything else falls through to the established tight-number layout.
  const showRange = confidence !== undefined && confidence !== 'honest' && range != null;

  const tierRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const pill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const pillText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };
  const tierMeta: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
    flex: 1,
  };

  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const numberRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: t.space[3],
    flexWrap: 'wrap',
  };
  const multNote: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    paddingBottom: t.space[1],
  };
  const provenanceText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // B15 reason note — a quiet, optional second provenance line. Display-only:
  // it sits below the number and never participates in computing it.
  const reasonNoteText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  // The learning line (under a band) and the honest affirmation (under a point).
  const learningLine: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const affirmRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1.5] };
  const affirmText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };

  return (
    <Card tone="focal" style={{ gap: t.space[3] }}>
      {tier ? (
        <View style={tierRow}>
          <View style={pill}>
            <Text style={pillText}>{tier}</Text>
          </View>
          <Text style={tierMeta}>
            {n} {n === 1 ? 'log' : 'logs'}
            {nextTier ? ` · ${logsToNext} to ${nextTier}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={eyebrowRow}>
        <Ionicons name="search-outline" size={16} color={t.colors.primary} />
        <Text style={eyebrow}>YOUR HONEST NUMBER FOR {categoryName.toUpperCase()}</Text>
      </View>

      {showRange && range ? (
        <>
          <View style={numberRow}>
            <HonestNumber
              size="xl"
              tone="indigo"
              value={`${range.lowMinutes}–${range.highMinutes}`}
              unit="min"
            />
          </View>
          <Text style={learningLine}>
            {LEARNING_LINE[confidence === 'raw' ? 'raw' : 'setting']}
          </Text>
        </>
      ) : (
        <>
          <View style={numberRow}>
            <HonestNumber size="xl" tone="indigo" value={`~${honestMinutes}`} unit="min" />
            <Text style={multNote}>runs {multiplier.toFixed(1)}×</Text>
          </View>
          {confidence === 'honest' ? (
            <View style={affirmRow}>
              <Ionicons name="checkmark-circle" size={t.iconSize.sm} color={t.colors.accent} />
              <Text style={affirmText}>Now an honest number</Text>
            </View>
          ) : null}
        </>
      )}

      <Text style={provenanceText}>{provenance} · learned on-device</Text>
      {reasonNote ? <Text style={reasonNoteText}>{reasonNote}</Text> : null}
    </Card>
  );
}
