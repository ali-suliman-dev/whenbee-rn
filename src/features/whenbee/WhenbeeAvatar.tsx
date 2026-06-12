import { View, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { type } from '@/src/theme/typography';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeAvatar — the companion. A small, procedural bumblebee in amber identity
// stripes (amber is the sanctioned Whenbee/honey accent). Its STAGE is derived
// 1:1 from `vm.tier` (Raw → Setting → Ripening → Thickening → Honest), with a
// "Keeper" read mapped onto the top tier so the most-ripened companion looks
// distinct. No setup wall, no dress-up game — presence, not a toy. A default bee
// ships immediately; an optional one-word name renders beside it when present.
//
// The stripes/wings/expression shift subtly by stage so progress is felt without
// any number: a Raw bee is pale with a flat mouth; a Honest/Keeper bee is fully
// saturated, wings up, with a small wax-cap crown. Static by design (companion,
// not a mascot animation) — geometry + color come from tokens, never inlined.
// ──────────────────────────────────────────────────────────────────────────────

/** 6 visual stages: the 5 tiers plus a "Keeper" prestige read for the top tier. */
type Stage = 0 | 1 | 2 | 3 | 4 | 5;

const TIER_STAGE: Record<Tier, Stage> = {
  Raw: 0,
  Setting: 1,
  Ripening: 2,
  Thickening: 3,
  Honest: 4,
};

const SIZE = 88;

export function WhenbeeAvatar({ tier, name }: { tier: Tier; name?: string }) {
  const t = useTheme();

  // Top tier reads as "Keeper" (stage 5) — the prestige look, distinct from a
  // freshly-Honest bee, so the ceiling still feels like an arrival.
  const stage: Stage = tier === 'Honest' ? 5 : TIER_STAGE[tier];

  // More honey as the bee ripens: pale → full amber. Body stays warm at every
  // stage so the bee is always recognizable (never grey/empty/"broken").
  const bodyFill = stage <= 0 ? t.colors.accentSoft : t.colors.accent;
  const stripeFill = t.colors.accentEdge;
  // Wings lift and saturate with progress; faint at first, clear once settling.
  const wingOpacity = 0.35 + stage * 0.1; // 0.35 → 0.85
  const wingLift = stage >= 3; // wings raised once "Thickening" and beyond
  // A gentle smile only once the bee has real data (Ripening+) — never a frown
  // before that (no-guilt invariant: an early bee is calm, not sad).
  const happy = stage >= 2;
  const crown = stage >= 5; // wax-cap crown for the Keeper

  const wingY = wingLift ? SIZE * 0.3 : SIZE * 0.4;

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[2] };
  const nameStyle: TextStyle = {
    ...(type.bodyLg as unknown as TextStyle),
    color: t.colors.ink,
  };

  return (
    <View style={wrap}>
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        accessibilityRole="image"
        accessibilityLabel={`${name ? name + ', your' : 'Your'} Whenbee companion — ${tier}${crown ? ', Keeper' : ''}`}
      >
        {/* Wings (behind the body) */}
        <G opacity={wingOpacity}>
          <Ellipse cx={SIZE * 0.33} cy={wingY} rx={SIZE * 0.16} ry={SIZE * 0.24} fill={t.colors.surface} stroke={t.colors.accentEdge} strokeWidth={1.5} />
          <Ellipse cx={SIZE * 0.67} cy={wingY} rx={SIZE * 0.16} ry={SIZE * 0.24} fill={t.colors.surface} stroke={t.colors.accentEdge} strokeWidth={1.5} />
        </G>

        {/* Crown (Keeper only) — a small wax-cap above the head */}
        {crown && (
          <Path
            d={`M${SIZE * 0.4},${SIZE * 0.2} L${SIZE * 0.46},${SIZE * 0.1} L${SIZE * 0.5},${SIZE * 0.18} L${SIZE * 0.54},${SIZE * 0.1} L${SIZE * 0.6},${SIZE * 0.2} Z`}
            fill={t.colors.accent}
            stroke={t.colors.accentEdge}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Body */}
        <Ellipse cx={SIZE * 0.5} cy={SIZE * 0.58} rx={SIZE * 0.26} ry={SIZE * 0.3} fill={bodyFill} stroke={stripeFill} strokeWidth={2} />

        {/* Identity stripes — clipped visually by sitting inside the body ellipse */}
        <G>
          <Path d={`M${SIZE * 0.3},${SIZE * 0.52} Q${SIZE * 0.5},${SIZE * 0.48} ${SIZE * 0.7},${SIZE * 0.52}`} stroke={stripeFill} strokeWidth={SIZE * 0.06} strokeLinecap="round" fill="none" />
          <Path d={`M${SIZE * 0.29},${SIZE * 0.66} Q${SIZE * 0.5},${SIZE * 0.62} ${SIZE * 0.71},${SIZE * 0.66}`} stroke={stripeFill} strokeWidth={SIZE * 0.06} strokeLinecap="round" fill="none" />
        </G>

        {/* Face — eyes + mouth that warm up with progress */}
        <Circle cx={SIZE * 0.43} cy={SIZE * 0.44} r={SIZE * 0.035} fill={t.colors.ink} />
        <Circle cx={SIZE * 0.57} cy={SIZE * 0.44} r={SIZE * 0.035} fill={t.colors.ink} />
        {happy ? (
          <Path d={`M${SIZE * 0.43},${SIZE * 0.49} Q${SIZE * 0.5},${SIZE * 0.54} ${SIZE * 0.57},${SIZE * 0.49}`} stroke={t.colors.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
        ) : (
          <Path d={`M${SIZE * 0.44},${SIZE * 0.5} L${SIZE * 0.56},${SIZE * 0.5}`} stroke={t.colors.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
        )}
      </Svg>

      {name ? <AppText style={nameStyle}>{name}</AppText> : null}
    </View>
  );
}
