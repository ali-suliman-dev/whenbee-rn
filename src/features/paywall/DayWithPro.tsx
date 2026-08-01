import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { featuresByMoment, type ProFeatureMoment } from './proFeatures';
import { DottedRail } from './DottedRail';

// ──────────────────────────────────────────────────────────────────────────────
// DayWithPro — the "a day with Pro" feature section (paywall variant 'day').
// The 12 Pro features live at the moment of day they help, riding a dotted rail
// from 7:00 to Sunday. All-indigo (locked C3) except the Sunday payoff moment,
// which is the one amber beat (honey = payoff semantics).
// ──────────────────────────────────────────────────────────────────────────────

interface Moment {
  moment: ProFeatureMoment;
  /** Clock times are 24-hour digits, identical in every supported language. The
   *  weekday beat is a word, so it carries a `paywall` key instead. */
  time: string | { key: 'moments.weekTime' };
  /** `paywall` namespace key for the heading, never English text. */
  headingKey: `moments.${ProFeatureMoment}`;
  icon: keyof typeof Ionicons.glyphMap;
  amber?: boolean;
}

const MOMENTS: readonly Moment[] = [
  { moment: 'morning', time: '7:00', headingKey: 'moments.morning', icon: 'repeat-outline' },
  {
    moment: 'deepwork',
    time: '9:30',
    headingKey: 'moments.deepwork',
    icon: 'notifications-outline',
  },
  {
    moment: 'midday',
    time: '13:00',
    headingKey: 'moments.midday',
    icon: 'battery-half-outline',
  },
  {
    moment: 'evening',
    time: '17:00',
    headingKey: 'moments.evening',
    icon: 'calendar-outline',
  },
  {
    moment: 'week',
    time: { key: 'moments.weekTime' },
    headingKey: 'moments.week',
    icon: 'document-text-outline',
    amber: true,
  },
];

export function DayWithPro() {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

  const wrap: ViewStyle = { paddingHorizontal: t.space[1] };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[3] };
  const timeCol: ViewStyle = { width: t.space[10], alignItems: 'flex-end', paddingTop: t.space[2] };
  const timeText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.inkFaint,
    fontVariant: ['tabular-nums'],
  };
  const railCol: ViewStyle = { width: t.size.momentCoin, alignItems: 'center' };
  const coinEdge = (amber: boolean): ViewStyle => ({
    borderRadius: t.radii.full,
    backgroundColor: amber ? t.colors.accentEdge : t.colors.surfaceRaisedEdge,
    paddingBottom: t.borderWidth.thick,
  });
  const coin = (amber: boolean): ViewStyle => ({
    width: t.size.momentCoin,
    height: t.size.momentCoin,
    borderRadius: t.radii.full,
    backgroundColor: amber ? t.colors.accent : t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  });
  const body: ViewStyle = {
    flex: 1,
    gap: t.space[1.5],
    paddingTop: t.space[1],
    paddingBottom: t.space[4],
  };
  const bodyLast: ViewStyle = { ...body, paddingBottom: t.space[1] };
  const heading: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };
  const chips: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[1.5] };
  // Both modes tint rather than fill: the indigo chips are a light wash of the CTA
  // and the Sunday payoff chips a wash of honey, so the amber beat still separates
  // without a solid block shouting over the heading. Light takes the deeper chip
  // tints (primaryChip/accentChip) — accentSoft's cream sat too close to the
  // lavender page to read as a chip at all.
  const isLight = t.mode === 'light';
  const chip = (amber: boolean): ViewStyle => ({
    backgroundColor: amber
      ? isLight
        ? t.colors.accentChip
        : t.colors.accentSoft
      : isLight
        ? t.colors.primaryChip
        : t.colors.primaryWash,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
  });
  // Label is ink on every tinted chip in both modes — the tint alone carries the
  // moment's colour, and ink keeps both chip families on one legible weight
  // (indigo-on-indigo and amber-on-amber both sat low against their own fill).
  const chipText = (): TextStyle => ({
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  });

  return (
    <View style={wrap}>
      {MOMENTS.map((m, i) => {
        const amber = m.amber === true;
        const last = i === MOMENTS.length - 1;
        return (
          <View key={m.moment} style={row}>
            <View style={timeCol}>
              <Text style={timeText}>
                {typeof m.time === 'string' ? m.time : tr(m.time.key)}
              </Text>
            </View>
            <View style={railCol}>
              <View style={coinEdge(amber)}>
                <View style={coin(amber)}>
                  <Ionicons
                    name={m.icon}
                    size={t.iconSize.sm}
                    color={amber ? t.colors.onAmber : t.colors.primary}
                  />
                </View>
              </View>
              {last ? null : <DottedRail />}
            </View>
            <View style={last ? bodyLast : body}>
              <Text style={heading}>{tr(m.headingKey)}</Text>
              <View style={chips}>
                {featuresByMoment(m.moment).map((f) => (
                  <View key={f.key} style={chip(amber)}>
                    <Text style={chipText()}>{tr(f.labelKey)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
