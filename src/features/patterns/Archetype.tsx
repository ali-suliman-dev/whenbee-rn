import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Circle, RadialGradient, Defs, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { ShareableCard } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import type { ArchetypeCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeHero (S1) — the FOCAL card of the Patterns screen. Your shareable time
// personality, sized up: a raised surface with a soft amber honey-glow, the large
// average multiplier, and a quiet share affordance. Identity first — the eye lands
// here before skimming the sectioned story below.
// ──────────────────────────────────────────────────────────────────────────────

export function ArchetypeHero({ card }: { card: ArchetypeCard }) {
  const t = useTheme();
  const archetypeShare = useShareCard('archetype');
  const { title: archTitle, blurb, averageMultiplier } = card;

  const cardStyle: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surfaceRaised,
    borderWidth: t.borderWidth.share,
    borderColor: t.colors.border,
    padding: t.space[5],
    gap: t.space[2],
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink, marginTop: t.space[1] };
  const multRow: ViewStyle = { flexDirection: 'row', alignItems: 'baseline', gap: t.space[1.5] };
  const mult: TextStyle = { ...(type.honestNumberLg as unknown as TextStyle), color: t.colors.accent };
  const multCaption: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const blurbStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft, maxWidth: 280 };
  const shareRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1], alignSelf: 'flex-start', marginTop: t.space[2] };
  const shareLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const provisionalPill: ViewStyle = {
    alignSelf: 'flex-start',
    backgroundColor: t.colors.surfaceSunken,
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
  };
  const provisionalText: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View style={cardStyle}>
      {/* Amber honey-glow — decorative, mode-independent alpha from tokens. */}
      <Svg width={180} height={180} style={{ position: 'absolute', top: -t.space[10], right: -t.space[8] }}>
        <Defs>
          <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={t.colors.accent} stopOpacity={t.gradients.backdropTop} />
            <Stop offset="70%" stopColor={t.colors.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={90} cy={90} r={90} fill="url(#heroGlow)" />
      </Svg>

      <View style={eyebrowRow}>
        <Text style={eyebrow}>YOUR TIME PERSONALITY</Text>
      </View>
      <Text style={titleStyle}>{archTitle}</Text>
      <View style={multRow}>
        <Text style={mult}>{averageMultiplier.toFixed(1)}×</Text>
        <Text style={multCaption}>your guess, on average</Text>
      </View>
      {card.provisional ? (
        <View style={provisionalPill}>
          <Text style={provisionalText}>Provisional · still learning</Text>
        </View>
      ) : null}
      <Text style={blurbStyle}>{blurb}</Text>
      <Pressable style={shareRow} onPress={archetypeShare.onShare}>
        <Ionicons name="share-outline" size={13} color={t.colors.inkSoft} />
        <Text style={shareLabel}>Share my archetype</Text>
      </Pressable>

      {/* Off-screen capture card — react-native-view-shot only; never visible. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <ShareableCard ref={archetypeShare.ref} data={{ kind: 'archetype', title: archTitle, blurb, averageMultiplier }} />
      </View>
    </View>
  );
}

export function ArchetypePlaceholder({ onTakeQuiz }: { onTakeQuiz: () => void }) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.share,
    borderColor: t.colors.border,
    padding: t.space[5],
    gap: t.space[2],
  };
  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.primary };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const bodyStyle: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={cardStyle}>
      <Text style={eyebrowStyle}>YOUR TIME PERSONALITY</Text>
      <Text style={titleStyle}>Meet your time personality</Text>
      <Text style={bodyStyle}>Answer a few quick questions, or keep logging and I&apos;ll figure it out.</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: t.space[2] }}>
        <AppButton label="Take the 20-sec quiz" variant="ghost" size="md" onPress={onTakeQuiz} />
      </View>
    </View>
  );
}
