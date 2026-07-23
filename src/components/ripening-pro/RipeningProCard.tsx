import { useEffect } from 'react';
import { View, Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { haptics } from '@/src/lib/haptics';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ProFeatureId } from '@/src/engine';
import { RipeningBand } from './RipeningBand';
import { FeatureReadinessList } from './FeatureReadinessList';
import { RIPENING_COPY, REVEAL_COPY, ripeningHeaderCopy } from './copy';

// ──────────────────────────────────────────────────────────────────────────────
// RipeningProCard — two-state pure presentational card.
//
// Ripening (!pitchUnlocked):
//   Header pill + count-aware title/sub + feature tally bar + FeatureReadinessList
//   + a ticket-strip footer (calm copy + honey "Get Pro" chip). No hard CTA — the
//   chip previews the paywall, it never gates or pressures.
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
  nextTierName: string | null;
  logsToNext: number;
  features: {
    id: ProFeatureId;
    ready: boolean;
    waitLabel?: string;
    /** Real 0..1 progress fraction for the single next-up feature only. Never
     *  fabricated — omit rather than guess when no real fraction is derivable. */
    progress?: number;
  }[];
  onSeePro: () => void;
  onPreview: () => void;
}

// REVEAL_TRANSLATE_Y is now read from t.space[2.5] (=10) inside the component.

export function RipeningProCard({
  pitchUnlocked,
  nextTierName,
  logsToNext,
  features,
  onSeePro,
  onPreview,
}: RipeningProCardProps) {
  const t = useTheme();
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

  // ── honey chip press dip (ripening state) ─────────────────────────────────
  // AppButton-style scale dip: ease-out, no overshoot (plain withTiming, not a
  // spring). Reduced-motion skips the dip entirely.
  const chipScale = useSharedValue(1);

  function handleChipPressIn() {
    haptics.light();
    if (reducedMotion) return;
    chipScale.set(withTiming(t.scale.pressIn, { duration: t.motion.press, easing: t.motion.easing.out }));
  }

  function handleChipPressOut() {
    if (reducedMotion) return;
    chipScale.set(withTiming(1, { duration: t.motion.press, easing: t.motion.easing.out }));
  }

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chipScale.get() }],
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

  const footerText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  // Tally bar: one rounded segment per feature + a trailing "{n} of {total}" caption.
  const tallyRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };

  const tallyTrack: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    gap: t.space[1],
  };

  const tallySegmentTrack: ViewStyle = {
    flex: 1,
    height: t.progress.tally,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.honeyWash,
    overflow: 'hidden',
  };

  const tallySegmentFill: ViewStyle = {
    height: '100%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
  };

  const tallyCaptionText: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.amberText,
  };

  // On light, a bare amberText caption reads muddy — give it an accentSoft pill.
  // Dark amberText is fine bare (per the global amber rule).
  const tallyCaptionPill: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    paddingHorizontal: t.space[1.5],
    paddingVertical: t.space[0.5],
    borderRadius: t.radii.full,
  };

  // Ticket strip: the calm ownership footer that replaces the old HoneyBar/meta row.
  const ticketStrip: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surfaceSunken,
    borderRadius: t.radii.panel,
    padding: t.space[3],
    position: 'relative',
  };

  // Ghost hex watermark — decorative, never intercepts touches.
  const ticketGhost: TextStyle = {
    position: 'absolute',
    top: -t.space[4],
    right: -t.space[2],
    fontSize: t.fontSize.ghostWatermark,
    color: t.colors.accentGhost,
  };

  const ticketLeft: ViewStyle = { flex: 1, gap: t.space[0.5] };

  const ticketTitleText: TextStyle = {
    fontFamily: 'Jakarta-Bold',
    fontSize: t.fontSize.ticketTitle,
    color: t.colors.ink,
  };

  const ticketSubText: TextStyle = {
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.ticketSub,
    lineHeight: Math.round(t.fontSize.ticketSub * t.lineHeight.normal),
    color: t.colors.inkSoft,
  };

  // Honey "Get Pro" chip — coin-edge pill, no price text (RevenueCat owns that).
  const chipInner: ViewStyle = {
    position: 'relative',
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
    paddingVertical: t.space[2],
    paddingHorizontal: t.space[4],
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: t.borderWidth.coin,
    borderBottomColor: t.colors.accentEdge,
  };

  const chipSheen: ViewStyle = {
    position: 'absolute',
    top: t.space[0.5],
    left: '8%',
    right: '40%',
    height: '38%',
    borderRadius: t.radii.full,
    backgroundColor: t.colors.sheenChip,
  };

  const chipLabelText: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    fontFamily: 'Jakarta-Bold',
    color: t.colors.onAmber,
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
  const pillLabel = pitchUnlocked
    ? `${REVEAL_COPY.pill} ✦`
    : nextTierName != null
      ? `${RIPENING_COPY.pillPrefix} ${nextTierName}`
      : RIPENING_COPY.pillPrefix;

  const eyebrow = pitchUnlocked ? REVEAL_COPY.eyebrow : RIPENING_COPY.eyebrow;

  // ── ripening header + tally derivations ───────────────────────────────────
  const readyCount = features.filter((f) => f.ready).length;
  const totalFeatures = features.length;
  const header = ripeningHeaderCopy(readyCount, totalFeatures);
  const nextUpId = features.find((f) => !f.ready)?.id;
  const tallyCaption = `${readyCount} of ${totalFeatures}`;

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
            <Text style={headlineText}>{REVEAL_COPY.headline}</Text>
            <Text style={subText}>{REVEAL_COPY.sub}</Text>
          </View>

          {/* Ripening band (revealed) — no fabricated tick labels. */}
          {/* Real low/high band labels are a follow-up (see plan: real band wiring, out of scope here). */}
          <RipeningBand revealed />

          {/* Feature readiness list */}
          <FeatureReadinessList items={features} logsToNext={logsToNext} />

          {/* Amber coin-edge CTA */}
          <Pressable onPress={onSeePro} accessibilityRole="button">
            <View style={ctaInner}>
              <Text style={ctaText}>{REVEAL_COPY.cta}</Text>
            </View>
          </Pressable>

          {/* Escape hatch */}
          <Pressable onPress={onPreview} accessibilityRole="link">
            <Text style={escapeText}>{REVEAL_COPY.escape}</Text>
          </Pressable>
        </Animated.View>
      ) : (
        /* ── RIPENING STATE ─────────────────────────────────────────────── */
        <>
          {/* Title + sub — count-aware (0 / 1 / N of total ready) */}
          <View style={{ gap: t.space[1] }}>
            <Text style={titleText}>{header.title}</Text>
            <Text style={subText}>{header.sub}</Text>
          </View>

          {/* Tally bar — one segment per feature; ready = full accent, the
              single next-up feature = partial fill at its real progress
              fraction, others = an empty honeyWash track. Never fabricated —
              a next-up feature with no real fraction just renders empty. */}
          <View style={tallyRow}>
            <View style={tallyTrack}>
              {features.map((f) => (
                <View key={f.id} style={tallySegmentTrack}>
                  {f.ready ? (
                    <View style={[tallySegmentFill, { width: '100%' }]} />
                  ) : f.id === nextUpId && f.progress != null ? (
                    <View style={[tallySegmentFill, { width: `${Math.round(f.progress * 100)}%` }]} />
                  ) : null}
                </View>
              ))}
            </View>
            {t.mode === 'light' ? (
              <View style={tallyCaptionPill}>
                <Text style={tallyCaptionText}>{tallyCaption}</Text>
              </View>
            ) : (
              <Text style={tallyCaptionText}>{tallyCaption}</Text>
            )}
          </View>

          {/* Feature readiness list — done / next-up (partial) / wait pips */}
          <FeatureReadinessList items={features} logsToNext={logsToNext} />

          {/* Ticket strip — calm ownership frame + honey "Get Pro" chip. */}
          <View style={ticketStrip}>
            <Text style={ticketGhost} pointerEvents="none">
              ⬢
            </Text>
            <View style={ticketLeft}>
              <Text style={ticketTitleText}>{RIPENING_COPY.ticketTitle}</Text>
              <Text style={ticketSubText}>{RIPENING_COPY.ticketSub}</Text>
            </View>
            <Pressable
              onPress={onSeePro}
              onPressIn={handleChipPressIn}
              onPressOut={handleChipPressOut}
              accessibilityRole="button"
              accessibilityLabel={RIPENING_COPY.chipLabel}
            >
              <Animated.View style={chipStyle}>
                <View style={chipInner}>
                  <View style={chipSheen} pointerEvents="none" />
                  <Text style={chipLabelText}>{RIPENING_COPY.chipLabel}</Text>
                </View>
              </Animated.View>
            </Pressable>
          </View>

          {/* Footer — no CTA pressure, just the plain fact */}
          <Text style={footerText}>{RIPENING_COPY.footer}</Text>
        </>
      )}
    </View>
  );
}
