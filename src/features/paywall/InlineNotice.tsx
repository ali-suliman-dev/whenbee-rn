import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// InlineNotice — the paywall's in-place message band (purchase errors, restore
// outcomes). Danger keeps the user on the paywall with selection preserved; the
// CTA below becomes the retry. Neutral is for non-error outcomes (restore found
// nothing) — informational ink, never red.
// ──────────────────────────────────────────────────────────────────────────────

export function InlineNotice({
  tone,
  title,
  message,
}: {
  tone: 'danger' | 'neutral';
  title?: string;
  message: string;
}) {
  const t = useTheme();

  const wrap: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space[2.5],
    backgroundColor: tone === 'danger' ? t.colors.dangerSoft : t.colors.surfaceSunken,
    borderRadius: t.radii.md,
    borderCurve: 'continuous',
    padding: t.space[3],
  };
  const badge: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: t.space[0.5],
  };
  const badgeText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.surface,
    fontFamily: 'Jakarta-Bold',
  };
  const body: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: tone === 'danger' ? t.colors.ink : t.colors.inkSoft,
    flex: 1,
  };
  const strong: TextStyle = { fontFamily: 'Jakarta-Bold', color: t.colors.danger };

  return (
    <View style={wrap} accessibilityRole="alert">
      {tone === 'danger' ? (
        <View style={badge}>
          <Text style={badgeText}>!</Text>
        </View>
      ) : null}
      <Text style={body}>
        {title ? <Text style={strong}>{title} </Text> : null}
        {message}
      </Text>
    </View>
  );
}
