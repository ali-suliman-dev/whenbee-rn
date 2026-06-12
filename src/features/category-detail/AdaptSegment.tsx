import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// AdaptSegment — "Tune how I learn": Steady | Balanced | Reactive.
//
// Maps to the engine's EWMA α (steady=slow, balanced=default, reactive=fast).
// Selected segment = white pill + indigo text; caption explains the chosen mode.
// No guilt, no red — this is a "you're in control" lever (Nielsen #3).
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: { value: AdaptSpeed; label: string }[] = [
  { value: 'steady', label: 'Steady' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'reactive', label: 'Reactive' },
];

const HINTS: Record<AdaptSpeed, string> = {
  steady: 'Slow to change — leans on your full history. Best when your pace is consistent.',
  balanced: 'The default — a fair mix of history and recent runs.',
  reactive: 'Adapts fast when your pace shifts — meds, sleep, a new routine.',
};

interface AdaptSegmentProps {
  value: AdaptSpeed;
  onChange: (speed: AdaptSpeed) => void;
}

export function AdaptSegment({ value, onChange }: AdaptSegmentProps) {
  const t = useTheme();

  const header: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const track: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: t.colors.paper,
    borderRadius: t.radii.pill,
    padding: 4,
    gap: 4,
  };
  const hint: TextStyle = { ...(type.caption as unknown as TextStyle), color: t.colors.inkSoft };

  function segmentStyle(selected: boolean): ViewStyle {
    return {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radii.pill,
      backgroundColor: selected ? t.colors.surface : 'transparent',
      ...(selected
        ? {
            shadowColor: t.colors.hairline,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 1,
          }
        : {}),
    };
  }

  function labelStyle(selected: boolean): TextStyle {
    return {
      ...(type.bodySm as unknown as TextStyle),
      color: selected ? t.colors.primary : t.colors.inkSoft,
      fontFamily: 'Jakarta-Bold',
    };
  }

  return (
    <View style={{ gap: t.space[3] }}>
      <Text style={header}>Tune how I learn</Text>

      <View style={track} accessibilityRole="tablist">
        {OPTIONS.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} learning mode`}
              style={segmentStyle(selected)}
            >
              <Text style={labelStyle(selected)}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={hint}>{HINTS[value]}</Text>
    </View>
  );
}
