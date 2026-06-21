import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';

// ──────────────────────────────────────────────────────────────────────────────
// ProTeaserCard — the ONE premium Pro upsell on Patterns (replaces the three flat
// *Locked teasers). A frosted preview panel (faux-blur: low-opacity teased bars +
// a scrim, no native blur dep) wears an amber "Pro" pill; below, the WHENBEE PRO
// eyebrow, a benefit headline, an outcome line, an amber coin-edge CTA, and a calm
// reassurance footer. Identity-first screen, gentle pitch last — never guilt.
// ──────────────────────────────────────────────────────────────────────────────

export type ProTeaserPreview = 'bars' | 'rhythm';

export interface ProTeaserProps {
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  trigger: string;
  preview: ProTeaserPreview;
}

/** Teased, deliberately-illegible feature visual behind a scrim. */
function Preview({ kind }: { kind: ProTeaserPreview }) {
  const t = useTheme();
  const heights = kind === 'rhythm' ? [0.42, 0.66, 0.34, 1, 0.58, 0.4, 0.3] : [0.5, 0.8, 0.45, 0.7, 0.95, 0.6, 0.4];
  const panel: ViewStyle = {
    position: 'relative', overflow: 'hidden',
    height: t.proTeaser.previewH, borderRadius: t.radii.md, borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceSunken, justifyContent: 'flex-end',
    padding: t.space[4],
  };
  const bars: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.proTeaser.barGap, height: t.proTeaser.previewH * 0.55, opacity: t.proTeaser.barOpacity };
  const scrim: ViewStyle = { position: 'absolute', inset: 0, backgroundColor: t.colors.surfaceSunken, opacity: t.proTeaser.scrimOpacity } as ViewStyle;
  const pill: ViewStyle = {
    position: 'absolute', top: t.space[3], right: t.space[3], flexDirection: 'row', alignItems: 'center', gap: t.space[1],
    backgroundColor: t.colors.accent, paddingHorizontal: t.proTeaser.pillPadX, paddingVertical: t.space[1], borderRadius: t.radii.full,
  };
  const pillText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.onAmber };
  return (
    <View style={panel}>
      <View style={bars}>
        {heights.map((hf, i) => (
          <View key={i} style={{ flex: 1, height: `${hf * 100}%`, backgroundColor: t.colors.accent, borderTopLeftRadius: t.proTeaser.barRadius, borderTopRightRadius: t.proTeaser.barRadius }} />
        ))}
      </View>
      <View style={scrim} pointerEvents="none" />
      <View style={pill}>
        <Ionicons name="lock-closed" size={t.iconSize.xs} color={t.colors.onAmber} />
        <Text style={pillText}>Pro</Text>
      </View>
    </View>
  );
}

export function ProTeaserCard({ eyebrow, headline, sub, cta, trigger, preview }: ProTeaserProps) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: t.colors.surfaceRaised, borderRadius: t.radii.card, borderCurve: 'continuous',
    borderWidth: t.borderWidth.share, borderColor: t.colors.border, padding: t.space[4], gap: t.space[3],
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrowText: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.amberText };
  const headlineStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const subStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  const foot: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkFaint, textAlign: 'center' };

  const openPaywall = () => router.push({ pathname: '/(modals)/paywall', params: { trigger } });

  return (
    <View style={cardStyle}>
      <Preview kind={preview} />
      <View style={{ gap: t.space[2] }}>
        <View style={eyebrowRow}><Text style={eyebrowText}>{eyebrow}</Text></View>
        <Text style={headlineStyle}>{headline}</Text>
        <Text style={subStyle}>{sub}</Text>
      </View>
      <AppButton label={cta} variant="amber" size="lg" fullWidth onPress={openPaywall} />
      <Text style={foot}>Cancel anytime · learned on-device</Text>
    </View>
  );
}
