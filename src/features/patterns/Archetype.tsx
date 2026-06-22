import { View, Text, Pressable, Platform, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { HoneyHexGlyph } from '@/src/components/HoneyHexGlyph';
import { ShareableCard } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { archetypeTraits } from './archetypeTraits';
import type { ArchetypeCard } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeHero (S1) — the FOCAL card of the Patterns screen, as a "stat-sheet":
// a rich (mode-independent) honey→indigo surface with a single honey-hex glyph, an
// amber eyebrow + the archetype title, and a short ledger of traits derived from the
// quiz answers + the calibration multiplier. Share is a real secondary pill BELOW
// the card (keeps the screen's one primary CTA). No border, no rank/"rare" copy.
// ──────────────────────────────────────────────────────────────────────────────

export function ArchetypeHero({ card }: { card: ArchetypeCard }) {
  const t = useTheme();
  const archetypeShare = useShareCard('archetype');
  const quizAnswers = useOnboardingStore((s) => s.quizAnswers);
  const { title: archTitle, blurb, averageMultiplier } = card;
  const rows = archetypeTraits(quizAnswers, averageMultiplier);

  const cardStyle: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: t.reveal.gradBot,
    padding: t.space[5],
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: t.shadow.lift.radius,
        shadowOffset: { width: 0, height: t.shadow.lift.offset },
      },
      default: { elevation: t.shadow.lift.elevation },
    }),
  };
  const headerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[4], marginBottom: t.space[5] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.accent };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.reveal.inkOn, marginTop: t.space[1] };
  const row: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.space[3] };
  const divider: ViewStyle = { borderTopWidth: t.borderWidth.share, borderTopColor: t.reveal.amberHairline };
  const rowLabel: TextStyle = { ...(type.body as unknown as TextStyle), color: t.reveal.blurbOn };
  const rowValue = (amber?: boolean): TextStyle => ({
    ...(type.bodyLg as unknown as TextStyle),
    color: amber ? t.brand.honeyFill : t.reveal.inkOn,
  });
  const shareBtn: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    marginTop: t.space[3],
    paddingHorizontal: t.space[4],
    height: t.size.control.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceRaised,
  };
  const shareLabel: TextStyle = { ...(type.bodySmBold as unknown as TextStyle), color: t.colors.ink };

  return (
    <View>
      <View style={cardStyle}>
        {/* Rich honey→indigo surface (clipped by the card's rounded overflow). */}
        <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          <Defs>
            <LinearGradient id="archGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={t.reveal.gradTop} />
              <Stop offset="0.55" stopColor={t.reveal.gradMid} />
              <Stop offset="1" stopColor={t.reveal.gradBot} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#archGrad)" />
        </Svg>

        <View style={headerRow}>
          <HoneyHexGlyph />
          <View style={{ flex: 1 }}>
            <Text style={eyebrow}>YOUR TIME PERSONALITY</Text>
            <Text style={titleStyle}>{archTitle}</Text>
          </View>
        </View>

        {rows.map((r, i) => (
          <View key={r.label} style={[row, i > 0 ? divider : null]}>
            <Text style={rowLabel}>{r.label}</Text>
            <Text style={rowValue(r.amber)}>{r.value}</Text>
          </View>
        ))}
      </View>

      <Pressable style={shareBtn} onPress={archetypeShare.onShare} accessibilityRole="button">
        <Ionicons name="share-outline" size={t.iconSize.sm} color={t.colors.ink} />
        <Text style={shareLabel}>Share my archetype</Text>
      </Pressable>

      {/* Off-screen capture card — react-native-view-shot only; never visible. */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <ShareableCard
          ref={archetypeShare.ref}
          data={{ kind: 'archetype', title: archTitle, blurb, averageMultiplier }}
        />
      </View>
    </View>
  );
}

export function ArchetypePlaceholder({ onTakeQuiz }: { onTakeQuiz: () => void }) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    padding: t.space[5],
    gap: t.space[2],
  };
  const eyebrowStyle: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.accent };
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
