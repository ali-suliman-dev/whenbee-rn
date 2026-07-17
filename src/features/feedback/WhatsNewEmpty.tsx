import { View, type TextStyle } from 'react-native';
import Svg, { Text as SvgText } from 'react-native-svg';
import { AppText } from '@/src/components/AppText';
import { BeeMascot } from '@/src/components/BeeMascot';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// WhatsNewEmpty — "Resting bee" empty state for the What's New drawer (no
// changelog entries yet). A dozing companion (sleepy arc eyes, no motion) with
// a soft "zzz" and warm copy that ties the empty state back to the feedback
// loop, so it reads as "nothing YET" rather than a dead end. See
// docs/product/specs/2026-07-17-ui-polish-batch.md, Workstream 3.
// ──────────────────────────────────────────────────────────────────────────────

const ART_SIZE = 132;

export function WhatsNewEmpty() {
  const t = useTheme();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4] }}>
      <View style={{ width: ART_SIZE, height: ART_SIZE }}>
        <BeeMascot size={ART_SIZE} sleepy glow={false} />
        {/* Soft "zzz" drifting off the upper-right — decreasing size + opacity
            reads as the dozing bee's breath, not a UI badge. Own overlay Svg
            since BeeMascot renders its own <Svg> and takes no children. */}
        <Svg
          width={ART_SIZE}
          height={ART_SIZE}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <SvgText
            x={ART_SIZE * 0.78}
            y={ART_SIZE * 0.28}
            fill={t.colors.accent}
            fontSize={t.fontSize.lg}
            fontWeight={t.fontWeight.bold}
          >
            z
          </SvgText>
          <SvgText
            x={ART_SIZE * 0.88}
            y={ART_SIZE * 0.18}
            fill={t.colors.accent}
            fontSize={t.fontSize.md}
            fontWeight={t.fontWeight.bold}
            opacity={0.7}
          >
            z
          </SvgText>
          <SvgText
            x={ART_SIZE * 0.97}
            y={ART_SIZE * 0.1}
            fill={t.colors.accent}
            fontSize={t.fontSize.sm}
            fontWeight={t.fontWeight.bold}
            opacity={0.45}
          >
            z
          </SvgText>
        </Svg>
      </View>
      <View style={{ alignItems: 'center', gap: t.space[1.5] }}>
        <AppText style={{ ...(type.titleSm as TextStyle), color: t.colors.ink }}>All quiet for now</AppText>
        <AppText
          style={{
            ...(type.bodySm as TextStyle),
            color: t.colors.inkSoft,
            textAlign: 'center',
            maxWidth: 230,
          }}
        >
          When I ship something you asked for, it lands right here.
        </AppText>
      </View>
    </View>
  );
}
