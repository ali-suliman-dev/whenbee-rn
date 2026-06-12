import { useEffect, useRef } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';

// ──────────────────────────────────────────────────────────────────────────────
// OptimismNudge — the scarce amber over-run cue on the focus card.
//
// amberSoft pill + warning glyph + words (never color-only, never red, no guilt).
// Shown ONLY when there is personal evidence AND the honest number beats the
// guess; suppressed on prior basis. Caller owns that gating.
// ──────────────────────────────────────────────────────────────────────────────

interface OptimismNudgeProps {
  honestMin: number;
  /** The category this nudge is about (for the analytics surfacing event). */
  category: string;
  /** The user's raw guess that the honest number beat. */
  guessMin: number;
  /** Learned multiplier behind the nudge. */
  multiplier: number;
}

export function OptimismNudge({ honestMin, category, guessMin, multiplier }: OptimismNudgeProps) {
  const t = useTheme();

  // optimistic_nudge_shown: fire once per surfacing (category+guess), not per
  // render — the nudge only mounts when the caller's gating already passed.
  const lastShownRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${category}|${guessMin}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('optimistic_nudge_shown', { category, guess_min: guessMin, multiplier });
  }, [category, guessMin, multiplier]);

  const pill: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    alignSelf: 'flex-start',
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[2],
  };

  const copy: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    flexShrink: 1,
  };

  return (
    <View
      style={pill}
      accessibilityRole="text"
      accessibilityLabel={`You're being optimistic again — block ${honestMin} minutes.`}
    >
      <Ionicons name="warning-outline" size={15} color={t.colors.amberText} />
      <Text style={copy}>You&apos;re being optimistic again — block {honestMin}.</Text>
    </View>
  );
}
