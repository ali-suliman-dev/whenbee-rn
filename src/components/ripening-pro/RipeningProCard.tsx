import { View, Pressable, Text, type ViewStyle, type TextStyle } from 'react-native';
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
  const pillLabel = pitchUnlocked
    ? `${REVEAL_COPY.pill} ✦`
    : nextTierName != null
      ? `${RIPENING_COPY.pillPrefix} ${nextTierName}`
      : RIPENING_COPY.pillPrefix;

  const eyebrow = pitchUnlocked ? REVEAL_COPY.eyebrow : RIPENING_COPY.eyebrow;

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
        <>
          {/* Headline + sub */}
          <View style={{ gap: t.space[1] }}>
            <Text style={headlineText}>{REVEAL_COPY.headline}</Text>
            <Text style={subText}>{REVEAL_COPY.sub}</Text>
          </View>

          {/* Ripening band (revealed) — illustrative labels until wired to real data */}
          {/* TODO: wire real band labels from calibration data (Task 7) */}
          <RipeningBand revealed lowLabel="25m" highLabel="40m" />

          {/* Feature readiness list */}
          <FeatureReadinessList items={features} />

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
        </>
      ) : (
        /* ── RIPENING STATE ─────────────────────────────────────────────── */
        <>
          {/* Title + sub */}
          <View style={{ gap: t.space[1] }}>
            <Text style={titleText}>{RIPENING_COPY.title}</Text>
            <Text style={subText}>{RIPENING_COPY.sub}</Text>
          </View>

          {/* Settling band */}
          <RipeningBand revealed={false} />

          {/* HoneyBar + meta row */}
          <View style={{ gap: t.space[1] }}>
            <HoneyBar pct={honeyPct} />
            <View style={metaRow}>
              <Text style={metaText}>{honeyPct}% honey</Text>
              <Text style={metaText}>~{logsToNext} more logs</Text>
            </View>
          </View>

          {/* Footer — no CTA */}
          <Text style={footerText}>{RIPENING_COPY.footer}</Text>
        </>
      )}
    </View>
  );
}
