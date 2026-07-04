import { View, Text, type TextStyle, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '@/src/components/Card';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';

// ──────────────────────────────────────────────────────────────────────────────
// FounderReserveCard — shown ONLY before a user's numbers are honest. It lets
// them set aside the founder price now, as a no-charge promise. There is no
// purchase here and nothing is billed: tapping records intent (a kv flag). The
// real purchase still happens later, at this same store-read price.
//
// `priceString` always comes from the live offering's founder package — never a
// hardcoded literal. Flat card + hairline, tokens only, no shadow.
// ──────────────────────────────────────────────────────────────────────────────

export function FounderReserveCard({
  priceString,
  reserved,
  onReserve,
}: {
  priceString: string;
  reserved: boolean;
  onReserve: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('paywall');

  const eyebrow: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.amberText,
  };
  const headline: TextStyle = {
    ...(type.subtitle as unknown as TextStyle),
    color: t.colors.ink,
  };
  const sub: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
  };

  const card: ViewStyle = { gap: t.space[3] };
  const copy: ViewStyle = { gap: t.space[1] };

  return (
    <Card tone="flat" style={card}>
      <View style={copy}>
        <Text style={eyebrow}>{tr('founderReserve.eyebrow')}</Text>
        <Text style={headline}>{tr('founderReserve.headline', { price: priceString })}</Text>
        <Text style={sub}>{tr('founderReserve.sub')}</Text>
      </View>

      <AppButton
        label={reserved ? tr('founderReserve.ctaLocked') : tr('founderReserve.cta')}
        variant="amber"
        fullWidth
        disabled={reserved}
        onPress={onReserve}
      />
    </Card>
  );
}
