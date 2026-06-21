import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { analytics } from '@/src/services/analytics';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { useState } from 'react';
import { View, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { EnergyGlyph, type EnergyKind } from './EnergyGlyph';

const ENTER_STAGGER = 70;

// ──────────────────────────────────────────────────────────────────────────────
// EnergyChips (S4) — an optional, one-tap context tag captured after a log: how
// much energy this session had. Fully skippable, never required, and a pure
// side-channel: it writes a context tag (key 'energy') the calibration model
// never reads. Over time it powers the Pro "context" correlation ("on low-energy
// sessions your estimates run further off"). Tag once, then a calm acknowledgment.
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: readonly { value: EnergyKind; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'ok', label: 'OK' },
  { value: 'high', label: 'High' },
];

export function EnergyChips({ eventId }: { eventId: string }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const setContext = useCalibrationStore((s) => s.setContext);
  const [selected, setSelected] = useState<string | null>(null);

  function pick(value: string) {
    setSelected(value);
    void setContext(eventId, 'energy', value, 'manual');
    analytics.capture('context_tagged', { key: 'energy', value });
  }

  const wrap: ViewStyle = { gap: t.space[2] };
  const prompt: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkSoft,
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[2], width: '100%' };
  // Light indigo pill in light mode (the deepened glyph reads against it); the
  // plain surface well in dark mode reads fine already.
  const chipContainer: ViewStyle = {
    backgroundColor: t.mode === 'light' ? t.colors.primaryWash : t.colors.surfaceSunken,
    paddingHorizontal: t.space[3],
    paddingVertical: t.space[1.5],
    flex: 1,
    justifyContent: 'center',
  };

  return (
    <View style={wrap}>
      <AppText style={prompt}>{selected ? 'Noted.' : 'Energy this session? (optional)'}</AppText>
      <View style={row}>
        {OPTIONS.map((o, i) => (
          <Animated.View
            key={o.value}
            style={{ flex: 1 }}
            entering={
              reducedMotion
                ? undefined
                : FadeInDown.duration(t.motion.base)
                    .delay(i * ENTER_STAGGER)
                    .springify()
                    .damping(t.motion.spring.damping)
                    .stiffness(t.motion.spring.stiffness)
            }
          >
            <Chip
              label={o.label}
              icon={<EnergyGlyph kind={o.value} active={selected === o.value} />}
              selected={selected === o.value}
              style={{ flex: 1 }}
              containerStyle={chipContainer}
              onPress={() => pick(o.value)}
            />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}
