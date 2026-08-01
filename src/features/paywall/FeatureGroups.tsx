import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { featuresByGroup, type ProFeature, type ProFeatureGroup } from './proFeatures';

// ──────────────────────────────────────────────────────────────────────────────
// FeatureGroups — the "Plan · Do · Learn" feature section (paywall variant
// 'groups'). All 12 Pro features under three quiet small-caps headers, two
// aligned columns per group. All-indigo (locked C3): the section never competes
// with the amber CTA.
// ──────────────────────────────────────────────────────────────────────────────

/** Group order + the `paywall` key carrying each heading (never English text). */
const GROUPS: readonly { group: ProFeatureGroup; headingKey: `groups.${ProFeatureGroup}` }[] = [
  { group: 'plan', headingKey: 'groups.plan' },
  { group: 'run', headingKey: 'groups.run' },
  { group: 'learn', headingKey: 'groups.learn' },
];

function pairs(features: ProFeature[]): ProFeature[][] {
  const rows: ProFeature[][] = [];
  for (let i = 0; i < features.length; i += 2) rows.push(features.slice(i, i + 2));
  return rows;
}

export function FeatureGroups() {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

  const wrap: ViewStyle = { gap: t.space[3], paddingHorizontal: t.space[1] };
  const groupWrap: ViewStyle = { gap: t.space[2] };
  const heading: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkSoft,
    letterSpacing: t.letterSpacing.wide,
    textTransform: 'uppercase',
  };
  const row: ViewStyle = { flexDirection: 'row', gap: t.space[2.5] };
  const item: ViewStyle = { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const coin: ViewStyle = {
    width: t.size.checkCoin,
    height: t.size.checkCoin,
    borderRadius: t.radii.full,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const label: TextStyle = {
    ...(type.caption as unknown as TextStyle),
    color: t.colors.ink,
    fontFamily: 'Jakarta-Bold',
    flex: 1,
  };

  return (
    <View style={wrap}>
      {GROUPS.map(({ group, headingKey }) => (
        <View key={group} style={groupWrap}>
          <Text style={heading}>{tr(headingKey)}</Text>
          {pairs(featuresByGroup(group)).map((pair, i) => (
            <View key={i} style={row}>
              {pair.map((f) => (
                <View key={f.key} style={item}>
                  <View style={coin}>
                    <Ionicons name="checkmark" size={t.iconSize.xs} color={t.colors.primary} />
                  </View>
                  <Text style={label}>{tr(f.labelKey)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
