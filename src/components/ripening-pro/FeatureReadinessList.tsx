import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { ProFeatureId } from '@/src/engine';
import { featureLabel, logsToGoLabel } from './copy';

// ──────────────────────────────────────────────────────────────────────────────
// FeatureReadinessList — pure presentational component showing the ripening status
// of each Pro feature.
//
// Three row types:
//   done (ready):  filled amber pip with white check, label in ink, "Ready" in amber
//   part (next-up): the FIRST not-ready item — surface pip with a 2px accent ring
//                  showing the remaining-logs number, status "{k} logs to go"
//   wait (others): hollow pip (sunken bg + lavender border), label muted, waitLabel muted
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
  /** Remaining logs to the next tier — shown on the single next-up (first
   *  not-ready) feature's pip number and status label. */
  logsToNext: number;
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

export function FeatureReadinessList({ items, logsToNext }: FeatureReadinessListProps) {
  const t = useTheme();

  // The single "next-up" feature is the first not-yet-ready item in list order —
  // it gets the partial pip + the countable "{k} logs to go" status.
  const nextUpId = items.find((item) => !item.ready)?.id;

  // Container: all rows with gap between them, single spacing axis
  const container: ViewStyle = { gap: t.space[2.5] };

  // One row per item: icon | label [trailing status]
  const row: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2.5] };

  // Done pip (ready): filled amber circle
  const donePip: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Part pip (next-up): surface fill with a 2px accent ring, holds the count.
  const partPip: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  };

  // Wait pip (others): hollow circle with lavender border.
  // borderWidth.thin is 0 (borders globally zeroed) — use chip (=1) for a visible ring.
  const waitPip: ViewStyle = {
    width: t.iconSize.md,
    height: t.iconSize.md,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.surfaceSunken,
    borderWidth: t.borderWidth.chip,
    borderColor: t.colors.primarySoft, // lavender ring
    justifyContent: 'center',
    alignItems: 'center',
  };

  const partPipText: TextStyle = {
    ...(type.numMicro as unknown as TextStyle),
    color: t.colors.amberText,
  };

  // Label text: ready row uses ink, everything else uses muted
  const labelReady: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    flex: 1,
  };

  const labelMuted: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkFaint,
    flex: 1,
  };

  // Trailing status text: "Ready" / "{k} logs to go" / waitLabel
  const statusReady: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.amberText,
    fontFamily: 'Jakarta-Bold',
  };

  const statusMuted: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
  };

  return (
    <View style={container}>
      {items.map((item) => {
        const isNextUp = item.id === nextUpId;
        const label = item.ready ? labelReady : labelMuted;
        return (
          <View key={item.id} style={row}>
            {item.ready ? (
              <View style={donePip} testID="feature-pip-ready">
                <CheckIcon size={t.iconSize.sm} color={t.colors.surface} />
              </View>
            ) : isNextUp ? (
              <View style={partPip} testID="feature-pip-part">
                <Text style={partPipText}>{logsToNext}</Text>
              </View>
            ) : (
              <View style={waitPip} testID="feature-pip-wait" />
            )}

            <Text style={label}>{featureLabel(item.id)}</Text>

            {item.ready ? (
              <Text style={statusReady}>Ready</Text>
            ) : isNextUp ? (
              <Text style={statusMuted}>{logsToGoLabel(logsToNext)}</Text>
            ) : item.waitLabel ? (
              <Text style={statusMuted}>{item.waitLabel}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
