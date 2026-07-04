import { useEffect } from 'react';
import { View, Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { HoneyBar } from '@/src/features/reward/HoneyBar';
import type { ProFeatureId } from '@/src/engine';
import { RipeningBand } from './RipeningBand';
import { FeatureReadinessList } from './FeatureReadinessList';
import { RIPENING_COPY, REVEAL_COPY } from './copy';

// ──────────────────────────────────────────────────────────────────────────────
// RipeningProCard — two-state pure presentational card.
//
// Ripening (!pitchUnlocked):
//   Header pill + title + sub + RipeningBand (settling) + HoneyBar + meta + footer.
//   No CTA — zero pressure; the user is just logging, the model is sharpening.
//
// Reveal (pitchUnlocked):
//   Header pill + headline + sub + RipeningBand (revealed) + FeatureReadinessList
//   + amber coin-edge CTA (onSeePro) + text escape link (onPreview).
//
// All values from tokens — no inline hex or raw px. Pressable is a bare touch
// wrapper; visuals live on an inner View (reactCompiler/nativewind gotcha).
// Coin-edge via a bottom-border View (no boxShadow — renders as a hard line on
// RN 0.81 / Fabric). No `exiting` animations (Fabric SIGABRT).
// ──────────────────────────────────────────────────────────────────────────────

export interface RipeningProCardProps {
  pitchUnlocked: boolean;
  honeyPct: number;
  nextTierName: string | null;
  logsToNext: number;
  features: { id: ProFeatureId; ready: boolean; waitLabel?: string }[];
  onSeePro: () => void;
  onPreview: () => void;
}

// REVEAL_TRANSLATE_Y is now read from t.space[2.5] (=10) inside the component.

export function RipeningProCard({
  pitchUnlocked,
  honeyPct,
  nextTierName,
  logsToNext,
  features,
  onSeePro,
  onPreview,
}: RipeningProCardProps) {
  const t = useTheme();
  const { t: tr } = useTranslation('patterns');
  const reducedMotion = useReducedMotion();

  // Vertical travel for reveal entrance — token t.space[2.5] = 10pt (calm settle, not a pop).
  const revealTranslateYPx = t.space[2.5];

  // ── reveal entrance animation ─────────────────────────────────────────────
  // ENTERING-ONLY: shared values animate in when pitchUnlocked becomes true.
  // No `exiting` — unmount is plain to avoid Fabric SIGABRT.
  // Reduced-motion: skip to final state immediately.
  const revealOpacity = useSharedValue(pitchUnlocked ? 1 : 0);
  const revealTranslateY = useSharedValue(pitchUnlocked ? 0 : revealTranslateYPx);

  useEffect(() => {
    if (!pitchUnlocked) return;
    if (reducedMotion) {
      revealOpacity.set(1);
      revealTranslateY.set(0);
      return;
    }
    const cfg = { duration: t.motion.reveal, easing: t.motion.easing.honey } as const;
    revealOpacity.set(withTiming(1, cfg));
    revealTranslateY.set(withTiming(0, cfg));
  }, [pitchUnlocked, reducedMotion, t.motion.reveal, t.motion.easing.honey, revealOpacity, revealTranslateY]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.get(),
    transform: [{ translateY: revealTranslateY.get() }],
  }));

  // ── card shell ────────────────────────────────────────────────────────────
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[3],
  };

  // ── header row ────────────────────────────────────────────────────────────
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const eyebrowLeft: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1.5],
  };

  const hexGlyph: TextStyle = {
    fontSize: t.fontSize.md,
    color: t.colors.amberText,
  };

  const eyebrowText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.amberText,
    textTransform: 'uppercase',
    letterSpacing: t.letterSpacing.wide,
  };

  // Amber pill (right side of header)
  const pill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    paddingHorizontal: t.space[2],
    paddingVertical: t.space[0.5],
    borderRadius: t.radii.full,
  };

  const pillText: TextStyle = {
    ...(type.micro as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };

  // ── ripening state styles ─────────────────────────────────────────────────
  const titleText: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    color: t.colors.ink,
  };

  const subText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const metaRow: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
  };

  const metaText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const footerText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // ── reveal state styles ───────────────────────────────────────────────────
  const headlineText: TextStyle = {
    ...(type.title as unknown as TextStyle),
    color: t.colors.ink,
  };

  // CTA button (coin-edge amber)
  // Pressable is bare wrapper; visuals on inner View.
  const ctaInner: ViewStyle = {
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.md,
    paddingVertical: t.space[3],
    paddingHorizontal: t.space[4],
    alignItems: 'center',
    // Coin-edge: a bottom border creates the tactile depth (no boxShadow on Fabric)
    borderBottomWidth: t.borderWidth.thick,
    borderBottomColor: t.colors.accentEdge,
  };

  const ctaText: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.onAmber,
  };

  const escapeText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.primary,
    textAlign: 'center',
  };

  // ── pill label ────────────────────────────────────────────────────────────
  const ripeningCopy = RIPENING_COPY(tr);
  const revealCopy = REVEAL_COPY(tr);
  const pillLabel = pitchUnlocked
    ? `${revealCopy.pill} ✦`
    : nextTierName != null
      ? `${ripeningCopy.pillPrefix} ${nextTierName}`
      : ripeningCopy.pillPrefix;

  const eyebrow = pitchUnlocked ? revealCopy.eyebrow : ripeningCopy.eyebrow;

  return (
    <View style={card}>
      {/* ── header row ──────────────────────────────────────────────────── */}
      <View style={headerRow}>
        <View style={eyebrowLeft}>
          <Text style={hexGlyph}>⬡</Text>
          <Text style={eyebrowText}>{eyebrow}</Text>
        </View>
        <View style={pill}>
          <Text style={pillText}>{pillLabel}</Text>
        </View>
      </View>

      {pitchUnlocked ? (
        /* ── REVEAL STATE ───────────────────────────────────────────────── */
        /* Animated.View carries the calm entrance: fade + small upward settle.
           ENTERING only — no `exiting` (Fabric SIGABRT risk on unmount).     */
        <Animated.View style={[{ gap: t.space[3] }, revealStyle]}>
          {/* Headline + sub */}
          <View style={{ gap: t.space[1] }}>
            <Text style={headlineText}>{revealCopy.headline}</Text>
            <Text style={subText}>{revealCopy.sub}</Text>
          </View>

          {/* Ripening band (revealed) — no fabricated tick labels. */}
          {/* Real low/high band labels are a follow-up (see plan: real band wiring, out of scope here). */}
          <RipeningBand revealed />

          {/* Feature readiness list */}
          <FeatureReadinessList items={features} />

          {/* Amber coin-edge CTA */}
          <Pressable onPress={onSeePro} accessibilityRole="button">
            <View style={ctaInner}>
              <Text style={ctaText}>{revealCopy.cta}</Text>
            </View>
          </Pressable>

          {/* Escape hatch */}
          <Pressable onPress={onPreview} accessibilityRole="link">
            <Text style={escapeText}>{revealCopy.escape}</Text>
          </Pressable>
        </Animated.View>
      ) : (
        /* ── RIPENING STATE ─────────────────────────────────────────────── */
        <>
          {/* Title + sub */}
          <View style={{ gap: t.space[1] }}>
            <Text style={titleText}>{ripeningCopy.title}</Text>
            <Text style={subText}>{ripeningCopy.sub}</Text>
          </View>

          {/* Settling band */}
          <RipeningBand revealed={false} />

          {/* HoneyBar + meta row */}
          <View style={{ gap: t.space[1] }}>
            <HoneyBar pct={honeyPct} />
            <View style={metaRow}>
              <Text style={metaText}>{tr('ripeningPro.card.honeyPct', { pct: honeyPct })}</Text>
              <Text style={metaText}>{tr('ripeningPro.card.logsToNext', { count: logsToNext })}</Text>
            </View>
          </View>

          {/* Footer — no CTA */}
          <Text style={footerText}>{ripeningCopy.footer}</Text>
        </>
      )}
    </View>
  );
}
