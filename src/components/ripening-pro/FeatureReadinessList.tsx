import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ProFeatureId } from '@/src/engine';
import { featureLabel } from './copy';

// ──────────────────────────────────────────────────────────────────────────────
// FeatureReadinessList — pure presentational component showing the ripening status
// of each Pro feature.
//
// Two row types:
//   Ready: filled amber pip with white check, label in ink, "Ready" label in amber
//   Ripening: hollow pip (sunken bg + lavender border), label muted, waitLabel muted
//
// Rows share identical vertical structure (sibling-row rule): single gap axis via
// flex gap, no per-child margins. All colors/space/radii/font from theme tokens.
// ──────────────────────────────────────────────────────────────────────────────

interface FeatureReadinessListProps {
  items: {
    id: ProFeatureId;
    ready: boolean;
    waitLabel?: string;
  }[];
}

// White check mark — uses react-native-svg (DOM svg/path renders nothing in RN).
function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Path
          d="M3 8.5l3 3 7-8"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export function FeatureReadinessList({ items }: FeatureReadinessListProps) {
  const t = useTheme();

  // Container: all rows with gap between them, single spacing axis
  const container: ViewStyle = { gap: t.space[2.5] };

  // One row per item: icon | label [trailing status]
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5] };

  // Ready pip: filled amber circle
  const readyPip: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Ripening pip: hollow circle with lavender border.
  // borderWidth.thin is 0 (borders globally zeroed) — use chip (=1) for a visible ring.
  const ripeningPip: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.primarySoft, // lavender ring
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Label text: ready row uses ink, ripening uses muted
  const labelReady: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };

  const labelRipening: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkFaint,
    flex: 1,
  };

  // Trailing status text: "Ready" or waitLabel
  const statusReady: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };

  const statusRipening: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  return (
    <View style={container}>
      {items.map((item) => (
        <View key={item.id} style={row}>
          {item.ready ? (
            <View style={readyPip} testID="feature-pip-ready">
              <CheckIcon size={t.iconSize.sm} color={t.colors.surface} />
            </View>
          ) : (
            <View style={ripeningPip} testID="feature-pip-ripening" />
          )}

          <Text style={item.ready ? labelReady : labelRipening}>
            {featureLabel(item.id)}
          </Text>

          {item.ready ? (
            <Text style={statusReady}>Ready</Text>
          ) : item.waitLabel ? (
            <Text style={statusRipening}>{item.waitLabel}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
