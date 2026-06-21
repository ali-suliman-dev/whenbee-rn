import { memo } from 'react';
import { View, Text, FlatList, type ViewStyle, type TextStyle, type ListRenderItem } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Discovery } from '@/src/domain/types';
import { DiscoveryHex } from './DiscoveryHex';
import {
  discoveryDirection,
  discoveryProof,
  multiplierValue,
  dirLabel,
  categoryLabel,
} from './discoveryDisplay';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesGallery — the full list of banked discoveries (newest first), as
// honey cards: a hex sign (amber + = longer, green − = faster), the category and
// a plain-15m-baseline proof, and the multiplier as the hero on the right.
//
// Flat surface (matches the hub's Your-areas / Pro cards) — no border, no indigo
// edge. Cards never expire or grey: a discovery is something you learned and that
// stays true. Empty state is an invitation, not a void.
// ──────────────────────────────────────────────────────────────────────────────

const DiscoveryCard = memo(function DiscoveryCard({ discovery }: { discovery: Discovery }) {
  const t = useTheme();
  const direction = discoveryDirection(discovery.multiplier);
  const tint = direction === 'longer' ? t.colors.accent : t.colors.success;

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const meta: ViewStyle = { flex: 1, minWidth: 0 };
  const cat: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const proof: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };
  const mult: TextStyle = {
    ...(type.honestNumberMd as unknown as TextStyle),
    color: tint,
    textAlign: 'right',
  };
  const times: TextStyle = { ...mult, fontSize: t.fontSize.md, opacity: t.opacity.pressed };
  const dir: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'right',
    marginTop: t.space[0.5],
  };

  return (
    <View style={card}>
      <DiscoveryHex direction={direction} size={t.discovery.hex} />
      <View style={meta}>
        <Text style={cat}>{categoryLabel(discovery.categoryId)}</Text>
        <Text style={proof}>{discoveryProof(discovery.honestForFifteen, direction)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={mult}>{multiplierValue(discovery.multiplier)}</Text>
          <Text style={times}>×</Text>
        </View>
        <Text style={dir}>{dirLabel(direction)}</Text>
      </View>
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
