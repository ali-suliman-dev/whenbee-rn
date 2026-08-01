import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Rect,
  G,
  Defs,
  Filter,
  FeGaussianBlur,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// ProHonestWeekTease — the always-on Pro anchor on the category screen.
//
// Sells the payoff (the Honest Week ritual), not a feature. A genuinely BLURRED
// peek of the locked week chart (real SVG gaussian blur, never the user's data)
// builds the curiosity gap; the outcome headline + one tactile amber coin-edge CTA
// carries the conversion. A subtle white diagonal sheen lifts the card.
//
// Amber = reward (indigo is NEVER the Pro CTA). No border. No guilt — soft sell.
// ──────────────────────────────────────────────────────────────────────────────

// Ghost bars — abstract, fixed heights (0–1). NOT the user's real week (we never
// leak locked data); just the shape of what Pro reveals.
const GHOST_BARS = [0.6, 0.85, 0.45, 1, 0.7, 0.55, 0.4];

// Peek geometry (SVG user units ≈ the rendered px width, so the blur reads even).
const PEEK_W = 300;
const PEEK_H = 96;
const PEEK_PAD = 12;
const PEEK_GAP = 9;
const BARS_BASE = 84; // bar baseline (y) inside the peek
const BARS_MAX = 50; // tallest bar height

export function ProHonestWeekTease() {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');

  function openPaywall() {
    analytics.capture('honest_range_locked_tap', { surface: 'category_detail' });
    router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pro_preview' } });
  }

  const card: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
    overflow: 'hidden',
  };

  const peek: ViewStyle = {
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  };
  const lockBadge: ViewStyle = {
    position: 'absolute',
    top: t.space[2],
    right: t.space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
  };
  const lockText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.onAmber };

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const trust: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'center',
  };

  const barW = (PEEK_W - PEEK_PAD * 2 - PEEK_GAP * (GHOST_BARS.length - 1)) / GHOST_BARS.length;

  return (
    <View style={card}>
      {/* A soft white diagonal reflection sweeping across the card — a glossy sheen
          band, brightest top-left, fading out by the middle. Behind the content. */}
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="proSheen" x1="0" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="white" stopOpacity={0.14} />
            <Stop offset="0.22" stopColor="white" stopOpacity={0.06} />
            <Stop offset="0.5" stopColor="white" stopOpacity={0} />
            <Stop offset="1" stopColor="white" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#proSheen)" />
      </Svg>

      {/* Locked peek — a real gaussian-blurred ghost chart + sharp Pro lock badge. */}
      <View style={peek}>
        <Svg width="100%" height={PEEK_H} viewBox={`0 0 ${PEEK_W} ${PEEK_H}`} preserveAspectRatio="none">
          <Defs>
            <Filter id="peekBlur" x="-15%" y="-15%" width="130%" height="130%">
              <FeGaussianBlur stdDeviation="4.5" />
            </Filter>
          </Defs>
          <G filter="url(#peekBlur)">
            <SvgText x={PEEK_PAD} y={20} fontSize={13} fontFamily="Jakarta-Medium" fill={t.colors.inkFaint}>
              {tr('proHonestWeekTease.peekLabel')}
            </SvgText>
            {GHOST_BARS.map((h, i) => {
              const barH = h * BARS_MAX;
              return (
                <Rect
                  key={i}
                  x={PEEK_PAD + i * (barW + PEEK_GAP)}
                  y={BARS_BASE - barH}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={t.colors.accent}
                  opacity={0.85}
                />
              );
            })}
          </G>
        </Svg>
        <View style={lockBadge}>
          <Ionicons name="lock-closed" size={t.iconSize.xs} color={t.colors.onAmber} />
          <Text style={lockText}>{tr('proHonestWeekTease.proLabel')}</Text>
        </View>
      </View>

      <View style={{ gap: t.space[2] }}>
        <Text style={eyebrow}>{tr('proHonestWeekTease.eyebrow')}</Text>
        <Text style={heading}>{tr('proHonestWeekTease.heading')}</Text>
        <Text style={body}>{tr('proHonestWeekTease.body')}</Text>
      </View>

      <AppButton variant="amber" fullWidth label={tr('proHonestWeekTease.cta')} onPress={openPaywall} />
      <Text style={trust}>{tr('proHonestWeekTease.trust')}</Text>
    </View>
  );
}
