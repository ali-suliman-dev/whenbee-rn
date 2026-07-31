import { View } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// RipeningRail — a slim, low-key look-ahead for the Ready screen: five amber-
// graded segments (Raw → Honest) with labels beneath. Not a progress bar for a
// tracked metric (nothing is being measured yet) — a preview of the ripening
// language the app will use once real logs start landing. First segment/label
// reads "now"; the rest fade toward `accentSoft` to read as "ahead", never as
// a locked/greyed-out state (no guilt framing).
// ──────────────────────────────────────────────────────────────────────────────

const STAGES = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest'] as const;

export function RipeningRail() {
  const t = useTheme();
  // Even fade from full accent to a whisper of it, five even steps.
  const opacities = t.ripeningFade;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: t.space[1] }}>
        {opacities.map((opacity, i) => (
          <View
            key={STAGES[i]}
            style={{
              flex: 1,
              height: t.size.progressPill,
              borderRadius: t.radii.full,
              backgroundColor: t.colors.accent,
              opacity,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.space[2] }}>
        {STAGES.map((label, i) => (
          <AppText
            key={label}
            style={{
              fontSize: t.fontSize.xs,
              color: i === 0 ? t.colors.accent : t.colors.inkFaint,
              fontWeight: i === 0 ? (t.fontWeight.semibold as '600') : (t.fontWeight.regular as '400'),
            }}
          >
            {label}
          </AppText>
        ))}
      </View>
    </View>
  );
}
