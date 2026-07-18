import type { ReactNode } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { AppText } from './AppText';

// ──────────────────────────────────────────────────────────────────────────────
// ProCoin — the raised amber "Pro" marker.
//
// Speaks the same coin-edge language as AppButton's filled amber variant: a solid
// `accent` face dropped onto a darker `accentEdge` sliver, full-radius so the rim
// reads as a coin rather than a stray underline. It NEVER animates — a badge is
// décor the user sees constantly, so a press/entrance would be noise (see the
// animation hard-rule). The edge height lives in `paddingBottom` so the sliver
// can't overlap a neighbour.
//
//   size="sm" — the inline "Pro" pill (captionBold)          e.g. Today focus hook
//   size="md" — the eyebrow "WHENBEE PRO" chip (uppercase)   e.g. Paywall header
//
// Pass `icon` already tinted `colors.onAmber` so it matches the label on the
// amber face.
// ──────────────────────────────────────────────────────────────────────────────

interface ProCoinProps {
  label: string;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

export function ProCoin({ label, icon, size = 'sm' }: ProCoinProps) {
  const t = useTheme();
  const EDGE = t.depth.shallowEdge; // a calm coin rim, not a slab

  const container: ViewStyle = { alignSelf: 'flex-start', paddingBottom: EDGE };

  // The darker "body" fills the whole box; the face covers all but the bottom
  // EDGE sliver, so the rim peeks out beneath a full-radius pill.
  const edgeBase: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    backgroundColor: t.colors.accentEdge,
  };

  const face: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[1],
    backgroundColor: t.colors.accent,
    borderRadius: t.radii.full,
    borderCurve: 'continuous',
    paddingHorizontal: size === 'md' ? t.space[2.5] : t.space[2],
    paddingVertical: size === 'md' ? t.space[1] : t.space[0.5],
  };

  const labelStyle: TextStyle = {
    ...((size === 'md' ? type.eyebrow : type.captionBold) as unknown as TextStyle),
    color: t.colors.onAmber,
  };

  return (
    <View style={container}>
      <View style={edgeBase} />
      <View style={face}>
        {icon ?? null}
        <AppText style={labelStyle}>{label}</AppText>
      </View>
    </View>
  );
}
