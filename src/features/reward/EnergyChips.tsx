import { useState } from 'react';
import { View, type ViewStyle, type TextStyle } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { analytics } from '@/src/services/analytics';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

// ──────────────────────────────────────────────────────────────────────────────
// EnergyChips (S4) — an optional, one-tap context tag captured after a log: how
// much energy this session had. Fully skippable, never required, and a pure
// side-channel: it writes a context tag (key 'energy') the calibration model
// never reads. Over time it powers the Pro "context" correlation ("on low-energy
// sessions your estimates run further off"). Tag once, then a calm acknowledgment.
// ──────────────────────────────────────────────────────────────────────────────

const OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'ok', label: 'OK' },
  { value: 'high', label: 'High' },
];

export function EnergyChips({ eventId }: { eventId: string }) {
  const t = useTheme();
  const setContext = useCalibrationStore((s) => s.setContext);
  const [selected, setSelected] = useState<string | null>(null);

  function pick(value: string) {
    setSelected(value);
    void setContext(eventId, 'energy', value, 'manual');
    analytics.capture('context_tagged', { key: 'energy', value });
  }

  const wrap: ViewStyle = { gap: t.space[2], alignItems: 'center' };
  const prompt: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: selected ? t.colors.accent : t.colors.inkSoft,
    textAlign: 'center',
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[2] };

  return (
    <View style={wrap}>
      <AppText style={prompt}>{selected ? 'Noted.' : 'Energy this session? (optional)'}</AppText>
      <View style={row}>
        {OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={selected === o.value}
            onPress={() => pick(o.value)}
          />
        ))}
      </View>
    </View>
  );
}
