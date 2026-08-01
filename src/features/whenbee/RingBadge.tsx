import { type } from '@/src/theme/typography';
import { useTheme } from '@/src/theme/useTheme';
import { Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Tier } from '@/src/domain/types';
import { ringCopy } from './ringCopy';

// `ringCopy` returns the engine's English Tier enum, so the displayed and spoken
// tier word comes from the whenbee bundle rather than the raw value.
const TIER_KEYS = {
  Raw: 'tiers.raw',
  Setting: 'tiers.setting',
  Ripening: 'tiers.ripening',
  Thickening: 'tiers.thickening',
  Honest: 'tiers.honest',
} as const satisfies Record<Tier, string>;

// Compact 2-line tier badge under the honey ring. Line 1: tier word + overall %.
// Line 2: per-stage human line + soft "logs to next" (or the sealed hold state).
export function RingBadge({ sharpness }: { sharpness: number }) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const { t: tc } = useTranslation('common');
  const c = ringCopy(sharpness, tr);
  const tierText = tr(TIER_KEYS[c.tier]);

  const wrap: ViewStyle = {
    alignSelf: 'center',
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.hairline,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.card,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[2],
    alignItems: 'center',
    gap: t.space[0.5],
  };
  const line1: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: t.fontSize.bodySm,
    color: t.colors.accent,
    fontVariant: ['tabular-nums'],
  };
  const line2: TextStyle = { ...(type.micro as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <View
      style={wrap}
      accessibilityRole="text"
      accessibilityLabel={tc('a11y.ringBadge', {
        tier: tierText,
        pct: c.pct,
        line: c.line,
        next: c.next,
      })}
    >
      <Text style={line1}>
        {tierText} {c.pct}%
      </Text>
      <Text style={line2} numberOfLines={1}>
        {c.sealed ? c.next : `${c.line} · ${c.next} →`}
      </Text>
    </View>
  );
}
