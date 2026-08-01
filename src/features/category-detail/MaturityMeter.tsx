import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { HoneyPips } from './HoneyPips';
import type { Meter } from './maturity';

// Maturity meter — TWO ROWS by design: the honey-cell pips on their own line,
// the caption on the line below. Never side-by-side (the caption must not wrap
// in a cramped column beside the pips).
export function MaturityMeter({ meter }: { meter: Meter }) {
  const t = useTheme();
  const { t: tr } = useTranslation('categoryDetail');
  const wrap: ViewStyle = { gap: t.space[3], marginTop: t.space[6] };
  const caption: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft };
  const strong: TextStyle = { color: t.colors.ink, fontFamily: 'Jakarta-Bold' };

  const lead = meter.settledButNoisy ? (
    <Text style={caption}>{tr('maturityMeter.settled')}</Text>
  ) : (
    <Text style={caption}>
      <Trans
        i18nKey="maturityMeter.runsLeft"
        ns="categoryDetail"
        count={meter.runsLeft}
        values={{ count: meter.runsLeft }}
        components={{ strong: <Text style={strong} /> }}
      />
    </Text>
  );

  return (
    <View style={wrap}>
      <HoneyPips filled={meter.filled} total={meter.total} />
      {lead}
    </View>
  );
}
