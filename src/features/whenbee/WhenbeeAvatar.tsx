import { View, type ViewStyle, type TextStyle } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { AppText } from '@/src/components/AppText';
import { BeeMascot, type BeeVariant } from '@/src/components/BeeMascot';
import { type } from '@/src/theme/typography';
import type { Tier } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// WhenbeeAvatar — the companion. Now a thin wrapper over the brand BeeMascot art.
// The bee is ONE static artwork at every tier (decision: progression is read from
// the honeycomb grid + tier trail, not the bee). The `tier` prop is kept so that
// when tier-specific artworks land, this maps tier → BeeMascot variant in one
// place — call sites (e.g. WhenbeeHub) stay untouched. An optional one-word name
// renders beneath, same as before.
// ──────────────────────────────────────────────────────────────────────────────

const SIZE = 88;

/** Maps a tier to a BeeMascot variant. Today every tier is the default artwork. */
function variantForTier(_tier: Tier): BeeVariant {
  return 'default';
}

export function WhenbeeAvatar({ tier, name }: { tier: Tier; name?: string }) {
  const t = useTheme();

  const wrap: ViewStyle = { alignItems: 'center', gap: t.space[2] };
  const nameStyle: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };

  return (
    <View style={wrap}>
      <BeeMascot size={SIZE} variant={variantForTier(tier)} />
      {name ? <AppText style={nameStyle}>{name}</AppText> : null}
    </View>
  );
}
