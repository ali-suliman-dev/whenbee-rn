import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { HonestNumber } from '@/src/components/HonestNumber';
import { HoneyHex } from '@/src/components/HoneyHex';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';
import { CategoryRangeBand } from './CategoryRangeBand';
import { MaturityMeter } from './MaturityMeter';
import { maturityMeter } from './maturity';

// ──────────────────────────────────────────────────────────────────────────────
// HonestCard — the category hero. While learning, the honest RANGE is the hero:
// a tier-meaning pill, the range number, a living band (segment + caret callout),
// and a two-row honey-cell maturity meter. Once honest it becomes a subtle hero:
// a faint honey-wash card carrying the single number, the multiplier as a quiet
// chip, and a honey-sealed affirmation. Range numbers + band are free; the precise
// convergence tick is the Pro layer (spec 03 §9). No guilt, amber never red.
// ──────────────────────────────────────────────────────────────────────────────

interface HonestCardProps {
  categoryName: string;
  honestMinutes: number;
  multiplier: number;
  provenance: string;
  tier?: string;
  n?: number;
  logsToNext?: number;
  nextTier?: string | null;
  confidence?: CalibrationConfidence;
  range?: HonestRange | null;
  reasonNote?: string;
  isPro?: boolean;
  firstHonestRange?: HonestRange | null;
}

// Plain-language meaning for the one-word tier pill (replaces "6 to Ripening").
const TIER_MEANING: Record<Exclude<CalibrationConfidence, 'honest'>, string> = {
  raw: 'just getting to know your pace',
  setting: 'still sharpening your pace',
};

export function HonestCard({
  honestMinutes, multiplier, tier, n = 0, confidence, range,
  reasonNote, isPro = false, firstHonestRange,
}: HonestCardProps) {
  const t = useTheme();
  const showRange = confidence !== undefined && confidence !== 'honest' && range != null;

  const tierRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const pill: ViewStyle = {
    flexDirection: 'row', alignItems: 'center', gap: t.space[1.5],
    backgroundColor: t.colors.accentSoft, borderRadius: t.radii.full,
    paddingHorizontal: t.space[3], paddingVertical: t.space[1],
  };
  const pillHex: ViewStyle = {
    width: t.space[2], height: t.space[2], borderRadius: t.radii.sm, backgroundColor: t.brand.honeyFill,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.amberText };
  const meaning: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };

  const heroBlock: ViewStyle = { gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const numberRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3], flexWrap: 'wrap' };
  const reasonNoteText: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint };
  const narrowCaption: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[6] };
  const strong: TextStyle = { color: t.colors.ink, fontFamily: 'Jakarta-Bold' };

  // ── Honest (collapsed) state — A: editorial, NO surface ──
  // The honest number is the page hero, sitting on the bare background. The
  // multiplier + honey seal collapse into ONE quiet meta line beneath it
  // (honey hex · "1.6× your guess · honest now"). No card chrome, no tint.
  const heroNaked: ViewStyle = { gap: t.space[3] };
  const metaRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const metaBase: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const metaStrong: TextStyle = { fontFamily: 'Inter-Bold', color: t.colors.ink, fontVariant: ['tabular-nums'] };
  const metaSeal: TextStyle = { fontFamily: 'Jakarta-Bold', color: t.colors.amberText };

  const learningTier = confidence === 'raw' ? 'raw' : 'setting';
  const meter = maturityMeter(n, confidence ?? 'setting');

  // Pro narrowing proof: a prior, wider range exists → show "tightened from".
  const narrowed =
    isPro && showRange && firstHonestRange != null && range != null &&
    firstHonestRange.highMinutes - firstHonestRange.lowMinutes >
      range.highMinutes - range.lowMinutes;

  const openPaywall = () => {
    analytics.capture('honest_range_locked_tap', { surface: 'category_detail' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'honest_range' } });
  };

  if (showRange && range) {
    // ── Learning state — the honest RANGE is the hero (unchanged) ──
    return (
      <View style={{ gap: t.space[4] }}>
        {tier ? (
          <View style={tierRow}>
            <View style={pill}>
              <View style={pillHex} />
              <Text style={pillText}>{tier}</Text>
            </View>
            <Text style={meaning}>{TIER_MEANING[learningTier]}</Text>
          </View>
        ) : null}

        <View style={heroBlock}>
          <Text style={eyebrow}>YOUR HONEST RANGE</Text>
          <View style={numberRow}>
            <HonestNumber size="xl" tone="ink" value={`${range.lowMinutes}–${range.highMinutes}`} unit="min" />
          </View>
          <CategoryRangeBand
            range={range}
            point={honestMinutes}
            confidence={confidence ?? 'setting'}
            isPro={isPro}
            priorRange={firstHonestRange}
            onUnlockPress={openPaywall}
          />
          {narrowed && firstHonestRange ? (
            <Text style={narrowCaption}>
              <Text style={strong}>Tightened from {firstHonestRange.lowMinutes}–{firstHonestRange.highMinutes}</Text>
              {' as you logged.'}
            </Text>
          ) : (
            <MaturityMeter meter={meter} />
          )}
          {reasonNote ? <Text style={reasonNoteText}>{reasonNote}</Text> : null}
        </View>
      </View>
    );
  }

  // ── Honest (collapsed) state — A: number-as-hero on the bare page, no card ──
  return (
    <View style={heroNaked}>
      <HonestNumber size="xl" tone="ink" value={`~${honestMinutes}`} unit="min" />
      <View style={metaRow}>
        <HoneyHex size={t.fontSize.caption} />
        <Text style={metaBase}>
          <Text style={metaStrong}>{multiplier.toFixed(1)}×</Text> your guess
          {confidence === 'honest' ? (
            <Text>
              {'   ·   '}
              <Text style={metaSeal}>honest now</Text>
            </Text>
          ) : null}
        </Text>
      </View>
      {reasonNote ? <Text style={reasonNoteText}>{reasonNote}</Text> : null}
    </View>
  );
}
