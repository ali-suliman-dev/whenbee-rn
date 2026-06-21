import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HonestNumber } from '@/src/components/HonestNumber';
import { HonestBand } from '@/src/components/HonestBand';
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
  /** True when the user has the Pro entitlement — gates the honest-band strip. */
  isPro?: boolean;
  /** The first meaningful band captured for this category (the "from" anchor for
   *  the narrowing caption). Null until the first band. */
  firstHonestRange?: HonestRange | null;
}

/** The category-detail narrowing caption (§10). Tightening only renders when the
 *  band actually got narrower; otherwise a neutral, no-guilt nudge. */
function narrowingCaption(was: HonestRange | null | undefined, now: HonestRange): string {
  if (was == null) return 'Log a few more and watch this tighten.';
  const wasWidth = was.highMinutes - was.lowMinutes;
  const nowWidth = now.highMinutes - now.lowMinutes;
  if (nowWidth >= wasWidth) return 'Log a few more and watch this tighten.';
  return `Tightened from ${was.lowMinutes}–${was.highMinutes} to ${now.lowMinutes}–${now.highMinutes} as you logged.`;
}

// While the model is still learning, the honest number is a band, not a point.
// The line under it names where it's at without ever reading as a shortfall.
const LEARNING_LINE: Record<Exclude<CalibrationConfidence, 'honest'>, string> = {
  raw: 'Still learning your pace. Every run you log narrows this range.',
  setting: 'Getting clearer. A few more runs and this lands on one honest number.',
};

export function HonestCard({
  honestMinutes,
  multiplier,
  tier,
  n,
  logsToNext,
  nextTier,
  confidence,
  range,
  reasonNote,
  isPro,
  firstHonestRange,
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

  // Hero block — eyebrow + number + learning line are ONE unit: tight internal
  // rhythm so they read as a single focal group, well separated from the rest.
  const heroBlock: ViewStyle = { gap: t.space[2] };
  // Quiet, neutral eyebrow — the number is the headline now, so the label recedes
  // (no loud indigo competing with the ink hero number).
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
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
  // B15 reason note — a quiet, optional second line that hugs the number group.
  // Display-only: it never participates in computing the number.
  const reasonNoteText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
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
  // Surface B band strip — a taller, labelled band with low/high end labels.
  const stripRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const endLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const narrowCaption: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[2],
  };
  const bandStrip: ViewStyle = { flex: 1 };

  return (
    <View style={{ gap: t.space[4] }}>
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

      <View style={heroBlock}>
        <Text style={eyebrow}>YOUR HONEST NUMBER</Text>

        {showRange && range ? (
          <>
            <View style={numberRow}>
              <HonestNumber
                size="xl"
                tone="ink"
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
              <HonestNumber size="xl" tone="ink" value={`~${honestMinutes}`} unit="min" />
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
        {reasonNote ? <Text style={reasonNoteText}>{reasonNote}</Text> : null}
      </View>

      {/* Surface B — the honest-band strip for Pro, while still learning. Free
          users get the always-on Pro tease (ProHonestWeekTease) on the screen
          instead, so nothing locked clutters the hero. */}
      {showRange && range && isPro ? (
        <View>
          <View style={stripRow}>
            <Text style={endLabel}>{range.lowMinutes}</Text>
            <View style={bandStrip}>
              <HonestBand
                range={range}
                point={honestMinutes}
                confidence={confidence ?? 'setting'}
                height={t.progress.gapTrack}
              />
            </View>
            <Text style={endLabel}>{range.highMinutes}</Text>
          </View>
          <Text style={narrowCaption}>{narrowingCaption(firstHonestRange, range)}</Text>
        </View>
      ) : null}
    </View>
  );
}
