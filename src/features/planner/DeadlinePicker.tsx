import { View } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { Chip } from '@/src/components/Chip';
import { formatClock } from '@/src/lib/time';

// ──────────────────────────────────────────────────────────────────────────────
// DeadlinePicker — a finish-by time chooser. No @react-native-community/datetimepicker
// in this project, so this is a lightweight preset-chips + ±15m stepper combo.
// All values are epoch ms anchored to `now`'s calendar day.
// ──────────────────────────────────────────────────────────────────────────────

const PRESET_HOURS = [16, 17, 18, 19, 20]; // 4pm – 8pm
const STEP_MIN = 15;

/** epoch ms for the given hour:minute on the same calendar day as `now`. */
function atTimeToday(now: number, hour: number, minute: number): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

export function DeadlinePicker({
  now,
  value,
  onChange,
}: {
  now: number;
  value: number | null;
  onChange: (ms: number) => void;
}) {
  const t = useTheme();

  function step(deltaMin: number) {
    const base = value ?? atTimeToday(now, 17, 0);
    onChange(base + deltaMin * 60_000);
  }

  return (
    <View style={{ gap: t.space[3] }}>
      <AppText variant="label">Finish by</AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] }}>
        {PRESET_HOURS.map((h) => {
          const ms = atTimeToday(now, h, 0);
          return (
            <Chip
              key={h}
              label={formatClock(ms)}
              selected={value === ms}
              onPress={() => onChange(ms)}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[3] }}>
        <Chip label={`− ${STEP_MIN}m`} onPress={() => step(-STEP_MIN)} />
        <AppText
          variant="title"
          style={{ minWidth: 88, textAlign: 'center', fontVariant: ['tabular-nums'] }}
        >
          {value === null ? '—' : formatClock(value)}
        </AppText>
        <Chip label={`+ ${STEP_MIN}m`} onPress={() => step(STEP_MIN)} />
      </View>
    </View>
  );
}
