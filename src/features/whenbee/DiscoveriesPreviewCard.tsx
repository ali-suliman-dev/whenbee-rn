import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/Card';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Discovery } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesPreviewCard — the hub teaser into the full Discoveries gallery. A
// quiet flat card under the Reclaim hero: the running count (the thing that only
// ever grows), the three most recent headlines, and a tap into the gallery.
//
// Framing: discoveries are things you've learned about yourself, banked for good.
// The count is a record of self-knowledge, never a score to beat.
//
// Rendered only when discoveryCount > 0 (the parent gates) — no empty teaser.
// ──────────────────────────────────────────────────────────────────────────────

const PREVIEW_COUNT = 3;

export function DiscoveriesPreviewCard({
  discoveries,
  discoveryCount,
}: {
  discoveries: Discovery[];
  discoveryCount: number;
}) {
  const t = useTheme();
  const preview = discoveries.slice(0, PREVIEW_COUNT);

  function open() {
    router.push('/(modals)/discoveries');
  }

  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const count: TextStyle = {
    ...(type.bigNumber as unknown as TextStyle),
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
  };
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  };
  const line: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const bullet: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };
  const lineText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, flex: 1 };
  const footerRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const footerText: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`See all ${discoveryCount} things you've learned`}
    >
      <Card style={{ gap: t.space[3] }}>
        <View style={headerRow}>
          <Text style={eyebrow}>DISCOVERIES</Text>
          <Text style={count}>{discoveryCount}</Text>
        </View>

        <View style={{ gap: t.space[1] }}>
          {preview.map((d) => (
            <View key={d.id} style={line}>
              <Text style={bullet}>▸</Text>
              <Text style={lineText} numberOfLines={1}>
                {d.headline}
              </Text>
            </View>
          ))}
        </View>

        <View style={footerRow}>
          <Text style={footerText}>See all {discoveryCount} you&apos;ve learned</Text>
          <Ionicons name="chevron-forward" size={16} color={t.colors.primary} />
        </View>
      </Card>
    </Pressable>
  );
}
