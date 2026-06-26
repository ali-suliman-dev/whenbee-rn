import { View, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { haptics } from '@/src/lib/haptics';

// ──────────────────────────────────────────────────────────────────────────────
// GoalCoachCard — the add-screen goal coach (spec 2026-06-26-goal-coach §1, the
// locked "E-sep" design). A SEPARATE neutral card below the amber HonestSuggestion
// card (which is unchanged). Ties the honest number to the user's active goal and
// offers a one-tap apply. Only the goal-aware bits live here; the honest number
// itself stays the calibration card's job. No-guilt, amber accents, no indigo.
// ──────────────────────────────────────────────────────────────────────────────

/** "mornings" → "Mornings". */
function cap(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

export function GoalCoachCard({
  categoryName,
  targetBand,
  worstValue,
  honestMinutes,
  guessMinutes,
  onApply,
}: {
  categoryName: string;
  /** "within ±{targetBand}%". */
  targetBand: number;
  /** The biggest time-of-day lever ("mornings"), or null for the plain line. */
  worstValue: string | null;
  honestMinutes: number;
  guessMinutes: number;
  /** Writes the honest number into the guess field. */
  onApply: () => void;
}) {
  const t = useTheme();
  const alreadyInside = honestMinutes === guessMinutes;

  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[3],
  };
  const headRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const chip: ViewStyle = {
    backgroundColor: t.colors.accentSoft,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[0.5],
  };
  const chipText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.amberText };
  const body: ViewStyle = { flexDirection: 'row', gap: t.space[2.5], alignItems: 'flex-start' };
  const iconWell: ViewStyle = {
    width: t.space[6],
    height: t.space[6],
    borderRadius: t.radii.sm,
    backgroundColor: t.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const line: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const strong: TextStyle = { color: t.colors.amberText, fontFamily: 'Jakarta-Bold' };

  // Apply row — a small honey coin button + a quiet "keep" affordance.
  const applyRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[3] };
  const coinWrap: ViewStyle = { paddingBottom: t.burst.coinEdge };
  const coinEdge: ViewStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: t.burst.coinEdge,
    bottom: 0,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.accentEdge,
  };
  const coinFace: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    minHeight: t.size.control.xs,
  };
  const coinText: TextStyle = { ...(type.captionBold as unknown as TextStyle), color: t.colors.onAmber };
  const keep: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };

  function apply() {
    haptics.selection();
    onApply();
  }

  return (
    <View style={card} accessibilityLabel={`Goal coach: aim within ${targetBand} percent`}>
      <View style={headRow}>
        <AppText style={eyebrow}>GOAL · COACH</AppText>
        <View style={chip}>
          <AppText style={chipText}>within ±{targetBand}%</AppText>
        </View>
      </View>

      <View style={body}>
        <View style={iconWell}>
          <Ionicons name="bulb-outline" size={t.iconSize.sm} color={t.colors.amberText} />
        </View>
        <AppText style={line}>
          {worstValue ? `${cap(worstValue)} run longest for you on ${categoryName} — ` : ''}
          <AppText style={strong}>~{honestMinutes}m</AppText> keeps you inside{' '}
          <AppText style={strong}>±{targetBand}%</AppText>.
        </AppText>
      </View>

      {!alreadyInside ? (
        <View style={applyRow}>
          <Pressable
            onPress={apply}
            accessibilityRole="button"
            accessibilityLabel={`Use ${honestMinutes} minutes`}
            style={coinWrap}
          >
            <View style={coinEdge} />
            <View style={coinFace}>
              <Ionicons name="arrow-down" size={t.iconSize.xs} color={t.colors.onAmber} />
              <AppText style={coinText}>Use {honestMinutes}m</AppText>
            </View>
          </Pressable>
          <AppText style={keep}>or keep {guessMinutes}m</AppText>
        </View>
      ) : null}
    </View>
  );
}
