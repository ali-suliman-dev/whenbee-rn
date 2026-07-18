import { useState } from 'react';
import { View, Text, Pressable, Platform, type LayoutChangeEvent, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppButton } from '@/src/components/AppButton';
import { ShareableCard } from '@/src/components/ShareableCard';
import { useShareCard } from '@/src/features/share/useShareCard';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { archetypeTraits } from './archetypeTraits';
import { archetypeStats } from './archetypeStats';
import type { ArchetypeCard, CalibrationMapRow } from './usePatterns';

// ──────────────────────────────────────────────────────────────────────────────
// ArchetypeHero (S1) — the FOCAL card of the Patterns screen. The card IS the stat
// (v8 mock, option A): on the mode-independent honey→indigo surface, the average
// calibration multiplier is a jeweled honey hero numeral with a one-line read, the
// archetype title sits above it, and any quiz-derived traits become a compact stat
// block BELOW a hairline (shown only when answered, so the card never looks barren).
// Share is a quiet secondary pill below the card (keeps the screen's one primary CTA).
// ──────────────────────────────────────────────────────────────────────────────

/** Honest, guilt-free one-liner under the hero multiplier. */
function multiplierRead(m: number): string {
  if (m <= 1.05) return 'right on your guess';
  return 'longer than you guess';
}

export function ArchetypeHero({
  card,
  calibrationMap = [],
}: {
  card: ArchetypeCard;
  /** Per-category learned map — drives the on-device stat rows (no quiz needed). */
  calibrationMap?: CalibrationMapRow[];
}) {
  const t = useTheme();
  // Measure the card so the gradient SVG gets an explicit viewBox + size — without
  // it react-native-svg renders a hard vertical seam (see svg-fullbleed-seam memory).
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const archetypeShare = useShareCard('archetype');
  const quizAnswers = useOnboardingStore((s) => s.quizAnswers);
  const { title: archTitle, blurb, averageMultiplier } = card;
  // The amber row IS the hero numeral now. Supporting rows = what the model has
  // LEARNED (tracked count, sharpest/longest category) first, then any quiz traits.
  const supporting = [
    ...archetypeStats(calibrationMap),
    ...archetypeTraits(quizAnswers, averageMultiplier).filter((r) => !r.amber),
  ].slice(0, 4);

  const cardStyle: ViewStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: t.radii.sheet,
    borderCurve: 'continuous',
    backgroundColor: t.reveal.gradBot,
    padding: t.space[5],
    // Dark only: soft drop lifting the card off near-black. In light the card is flat
    // and separates from the page by its lavender tint alone (no shadow).
    ...(t.mode === 'dark'
      ? Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowRadius: t.shadow.lift.radius,
            shadowOffset: { width: 0, height: t.shadow.lift.offset },
          },
          default: { elevation: t.shadow.lift.elevation },
        })
      : null),
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.reveal.eyebrowAccentOn };
  const titleStyle: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.reveal.inkOn, marginTop: t.space[1] };

  // Hero stat: a big honey numeral with a smaller deeper-amber "×", read beside it.
  const heroRow: ViewStyle = { flexDirection: 'row', alignItems: 'flex-end', gap: t.space[3], marginTop: t.space[5] };
  const heroNum: TextStyle = { ...(type.honestNumberHero as unknown as TextStyle), color: t.reveal.statOn };
  const heroX: TextStyle = { fontFamily: 'Inter-Bold', fontSize: t.fontSize.xl, color: t.reveal.statXOn, letterSpacing: -0.5 };
  const heroRead: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.reveal.blurbOn, flexShrink: 1, paddingBottom: t.space[2] };

  // Supporting LEARNED-stat block. An amber rule splits it from the hero; each row
  // is split from the next by a faint neutral hairline. All text is 10/12pt.
  const supportWrap: ViewStyle = {
    marginTop: t.space[5],
    borderTopWidth: t.borderWidth.share,
    borderTopColor: t.reveal.amberHairline,
  };
  const statRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.space[3],
  };
  const statDivider: ViewStyle = { borderTopWidth: t.borderWidth.share, borderTopColor: t.reveal.border };
  const statLabel: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.reveal.blurbOn };
  const statValue: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.reveal.inkOn };

  const shareBtn: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    marginTop: t.space[3],
    paddingHorizontal: t.space[3],
    height: t.size.control.xs,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceRaised,
  };
  const shareLabel: TextStyle = { ...(type.captionBold as unknown as TextStyle), fontSize: t.fontSize.xs, color: t.colors.ink };

  return (
    <View>
      <View style={cardStyle} onLayout={onLayout}>
        {/* Midnight-ink surface. Explicit viewBox + preserveAspectRatio="none" +
            measured size are REQUIRED — percentage sizing alone seams vertically. */}
        {size.w > 0 ? (
          <Svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="archGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={t.reveal.gradTop} />
                <Stop offset="0.55" stopColor={t.reveal.gradMid} />
                <Stop offset="1" stopColor={t.reveal.gradBot} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#archGrad)" />
          </Svg>
        ) : null}

        <Text style={eyebrow}>YOUR TIME PERSONALITY</Text>
        <Text style={titleStyle}>{archTitle}</Text>

        <View style={heroRow}>
          <Text style={heroNum} accessibilityLabel={`${averageMultiplier.toFixed(1)} times`}>
            {averageMultiplier.toFixed(1)}
            <Text style={heroX}>×</Text>
          </Text>
          <Text style={heroRead}>{multiplierRead(averageMultiplier)}</Text>
        </View>

        {supporting.length > 0 ? (
          <View style={supportWrap}>
            {supporting.map((r, i) => (
              <View key={r.label} style={[statRow, i > 0 ? statDivider : null]}>
                <Text style={statLabel}>{r.label}</Text>
                <Text style={statValue} numberOfLines={1}>
                  {r.value}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable style={shareBtn} onPress={archetypeShare.onShare} accessibilityRole="button">
        <Ionicons name="share-outline" size={t.iconSize.xs} color={t.colors.ink} />
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
  const hintStyle: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };
  const ctaRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.space[2],
  };
  return (
    <View style={cardStyle}>
      <Text style={eyebrowStyle}>YOUR TIME PERSONALITY</Text>
      <Text style={titleStyle}>Meet your time personality</Text>
      <Text style={bodyStyle}>
        A 20-second quiz names it now — or keep logging and I&apos;ll figure it out.
      </Text>
      <View style={ctaRow}>
        <AppButton label="Take the quiz" variant="indigo" size="sm" onPress={onTakeQuiz} />
        <Text style={hintStyle}>~20 sec</Text>
      </View>
    </View>
  );
}
