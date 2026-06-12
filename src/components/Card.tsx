import { View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import type { tokens } from '@/src/theme/tokens';

// ──────────────────────────────────────────────────────────────────────────────
// Card — Flat Tactical UI
//
// Flat surface with two elevation modes:
//   raised=false (default): 2px hairline border, no shadow
//   raised=true:  solid offset shadow (offset:6, radius:0, color:hairline) — never both
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
    backgroundColor: t.colors.surface,
    padding: t.space[4],
  };

  const elevation: ViewStyle = raised
    ? {
        // Solid offset shadow — cross-platform via shadowColor + elevation on Android
        shadowColor: t.colors.hairline,
        shadowOffset: { width: t.shadow.md.offset, height: t.shadow.md.offset },
        shadowOpacity: t.shadow.md.opacity,
        shadowRadius: t.shadow.md.radius,
        elevation: t.shadow.md.offset, // Android fallback
      }
    : {
        borderWidth: 2,
        borderColor: t.colors.hairline,
      };

  return (
    <View style={[base, elevation, style]} {...rest}>
      {children}
    </View>
  );
}
