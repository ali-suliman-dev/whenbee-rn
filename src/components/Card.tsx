import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import type { tokens } from '@/src/theme/tokens';

// ──────────────────────────────────────────────────────────────────────────────
// Card — Flat Tactical UI
//
// Flat surface with two elevation modes:
//   raised=false (default): 1px hairline border, no shadow
//   raised=true:  soft box-shadow (CSS string, cross-platform) — never both
//
// NOTE: Do not nest a Card inside a Card. The surface/shadow stack produces
// redundant elevation signals and the inner card's border fights the outer card's
// inset padding. Use a plain View for grouped sub-content inside a card.
// ──────────────────────────────────────────────────────────────────────────────

type RadiusKey = keyof typeof tokens.radii;

export function Card({
  raised = false,
  radius = 'card',
  style,
  children,
  ...rest
}: ViewProps & {
  raised?: boolean;
  radius?: RadiusKey;
  children?: React.ReactNode;
}) {
  const t = useTheme();

  const base: ViewStyle = {
    borderRadius: t.radii[radius],
    borderCurve: 'continuous',
    backgroundColor: t.colors.surface,
    padding: t.space[4],
  };

  // CSS box-shadow renders consistently on iOS + Android. The previous
  // shadowOffset/shadowRadius:0/elevation combo produced a hard offset "line"
  // rather than soft elevation; a low-opacity blur reads as a lifted surface.
  const elevation: ViewStyle = raised
    ? { boxShadow: `0px 4px 16px ${t.colors.shadowSoft}` }
    : { borderWidth: 1, borderColor: t.colors.hairline };

  return (
    <View style={[base, elevation, style]} {...rest}>
      {children}
    </View>
  );
}
