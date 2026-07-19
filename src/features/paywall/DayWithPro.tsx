import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  time: string;
  heading: string;
  icon: keyof typeof Ionicons.glyphMap;
  amber?: boolean;
}

const MOMENTS: readonly Moment[] = [
  { moment: 'morning', time: '7:00', heading: 'The morning starts honest', icon: 'repeat-outline' },
  { moment: 'deepwork', time: '9:30', heading: 'Deep work, kept company', icon: 'notifications-outline' },
  { moment: 'midday', time: '13:00', heading: 'Before you say yes to more', icon: 'battery-half-outline' },
  { moment: 'evening', time: '17:00', heading: 'The evening actually fits', icon: 'calendar-outline' },
  { moment: 'week', time: 'Sun', heading: 'The week, understood', icon: 'document-text-outline', amber: true },
];

export function DayWithPro() {
  const t = useTheme();

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
  const body: ViewStyle = { flex: 1, gap: t.space[1.5], paddingTop: t.space[1], paddingBottom: t.space[4] };
  const bodyLast: ViewStyle = { ...body, paddingBottom: t.space[1] };
  const heading: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };
  const chips: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[1.5] };
  const chip = (amber: boolean): ViewStyle => ({
    backgroundColor: amber ? t.colors.accentSoft : t.colors.primaryWash,
    borderRadius: t.radii.full,
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
  });
  const chipText: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
  };

  return (
    <View style={wrap}>
      {MOMENTS.map((m, i) => {
        const amber = m.amber === true;
        const last = i === MOMENTS.length - 1;
        return (
          <View key={m.moment} style={row}>
            <View style={timeCol}>
              <Text style={timeText}>{m.time}</Text>
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
              {last ? null : <DottedRail topOffset={t.size.momentCoin + t.borderWidth.thick} />}
            </View>
            <View style={last ? bodyLast : body}>
              <Text style={heading}>{m.heading}</Text>
              <View style={chips}>
                {featuresByMoment(m.moment).map((f) => (
                  <View key={f.key} style={chip(amber)}>
                    <Text style={chipText}>{f.label}</Text>
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
