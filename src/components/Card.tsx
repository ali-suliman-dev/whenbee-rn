import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import type { RadiusKey } from '@/src/theme/tokens';

// ──────────────────────────────────────────────────────────────────────────────
// Card — Flat Tactical UI
//
// One radius (`card`), one border width (`borderWidth.card` — the global knob), three tones:
//   flat   (default) — surface + 1px hairline border, no shadow. The workhorse.
//   raised           — surfaceRaised + soft shadow, no border. Lifted content.
//   focal            — raised + a single restrained indigo top edge. The screen's
//                      centerpiece (e.g. Today's FocusCard) — replaces the old
//                      ad-hoc 3px slab border with a thin, deliberate accent.
//
// NOTE: Do not nest a Card inside a Card. The surface/shadow stack produces
// redundant elevation signals and the inner card's border fights the outer card's
// inset padding. Use a plain View for grouped sub-content inside a card.
// ──────────────────────────────────────────────────────────────────────────────

type Tone = 'flat' | 'raised' | 'focal';

export function Card({
  tone,
  raised = false,
  radius = 'card',
  style,
  children,
  ...rest
}: ViewProps & {
  tone?: Tone;
  /** @deprecated use tone="raised" — kept for back-compat */
  raised?: boolean;
  radius?: RadiusKey;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const resolved: Tone = tone ?? (raised ? 'raised' : 'flat');

  const base: ViewStyle = {
    borderRadius: t.radii[radius],
    borderCurve: 'continuous',
    backgroundColor: resolved === 'flat' ? t.colors.surface : t.colors.surfaceRaised,
    padding: t.space[4],
  };

  // A low-opacity blur reads as a lifted surface (a hard offset/elevation:0 combo
  // renders as a "line", not soft depth). Flat tone uses a hairline edge instead.
  const elevation: ViewStyle =
    resolved === 'flat'
      ? { borderWidth: t.borderWidth.card, borderColor: t.colors.hairline }
      : { boxShadow: `0px 4px 16px ${t.colors.shadowSoft}` };

  // Focal: one restrained accent — a thin indigo top edge, not a 3px slab.
  const focal: ViewStyle =
    resolved === 'focal'
      ? { borderTopWidth: t.borderWidth.thin, borderTopColor: t.colors.primary }
      : {};

  return (
    <View style={[base, elevation, focal, style]} {...rest}>
      {children}
    </View>
  );
}
