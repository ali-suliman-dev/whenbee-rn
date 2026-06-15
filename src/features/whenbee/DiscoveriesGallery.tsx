import { memo } from 'react';
import { View, Text, FlatList, type ViewStyle, type TextStyle, type ListRenderItem } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { CATEGORY_NAMES } from '@/src/engine';
import type { Discovery } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesGallery — the full list of banked aha cards (every discovery, newest
// first). Reuses AhaCard's "night" + indigo-left-border vocabulary so a banked
// discovery reads as the same object you first met in category-detail.
//
// Cards never expire or grey — a discovery is something you learned about
// yourself, and that stays true. Empty state is an invitation, not a void.
// ──────────────────────────────────────────────────────────────────────────────

/** Seed-name map, else title-case the slug ("deep_work" → "Deep Work"). */
function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const DiscoveryCard = memo(function DiscoveryCard({ discovery }: { discovery: Discovery }) {
  const t = useTheme();
  // Mirrors AhaCard: a dark "night" callout on the cream surface (light mode), or
  // a normal raised card in dark mode where a near-black block would vanish.
  const isDark = t.mode === 'dark';
  const fg = isDark ? t.colors.ink : t.colors.paper;
  // The eyebrow stays legible on both surfaces; hierarchy comes from its small,
  // tracked, uppercase scale rather than a low-contrast tint that fails on night.
  const fgSoft = isDark ? t.colors.inkSoft : t.colors.paper;

  const card: ViewStyle = {
    backgroundColor: isDark ? t.colors.surfaceRaised : t.colors.night,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
    gap: t.space[1],
    borderWidth: isDark ? t.borderWidth.card : 0,
    borderColor: t.colors.hairline,
    borderLeftWidth: t.borderWidth.thick,
    borderLeftColor: t.colors.primary,
  };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: fgSoft };
  const headline: TextStyle = { ...(type.heading as unknown as TextStyle), color: fg };

  return (
    <View style={card}>
      <Text style={eyebrow}>{categoryLabel(discovery.categoryId)}</Text>
      <Text style={headline}>{discovery.headline}</Text>
    </View>
  );
});

const keyExtractor = (d: Discovery): string => d.id;
const renderItem: ListRenderItem<Discovery> = ({ item }) => <DiscoveryCard discovery={item} />;

function Separator() {
  const t = useTheme();
  return <View style={{ height: t.space[3] }} />;
}

function EmptyState() {
  const t = useTheme();
  const wrap: ViewStyle = { paddingTop: t.space[8], gap: t.space[2] };
  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={wrap}>
      <Text style={title}>Nothing here yet — and that&apos;s fine.</Text>
      <Text style={body}>
        Discoveries show up as Whenbee learns your patterns, usually after about five logs in an area.
        Keep tracking and they&apos;ll start landing here.
      </Text>
    </View>
  );
}

export function DiscoveriesGallery({ discoveries }: { discoveries: Discovery[] }) {
  const t = useTheme();
  if (discoveries.length === 0) return <EmptyState />;

  return (
    <FlatList
      data={discoveries}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: t.space[4], paddingBottom: t.space[12] }}
    />
  );
}
