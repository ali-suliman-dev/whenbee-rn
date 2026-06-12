import { useState } from 'react';
import { View, Text, Pressable, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Insight } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// AhaCard — the FREE discovery card (all categories). Dark "night" surface,
// indigo accent. Reframes an over-run as self-knowledge — never guilt.
//
//   ✨ Eye-opening discovery                    [×]
//   ~29m vs your 15m guess · runs 1.9×
//   Based on your last N completed {category} tasks, you run about {M}×.
//   No guilt — your brain thinks fast, execution just takes longer.
//
// Rendered by the parent only when insight !== null. Dismissible (local state).
// ──────────────────────────────────────────────────────────────────────────────

interface AhaCardProps {
  insight: Insight;
  categoryName: string;
  n: number;
}

export function AhaCard({ insight, categoryName, n }: AhaCardProps) {
  const t = useTheme();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  // Light mode: a deliberate dark "night" callout on cream (light text).
  // Dark mode: a normal raised card — a near-black block would vanish on the deep
  // bg — keeping the indigo accent + ink text.
  const isDark = t.mode === 'dark';
  const fg = isDark ? t.colors.ink : t.colors.paper;
  const fgSoft = isDark ? t.colors.inkSoft : t.colors.paper;
  const card: ViewStyle = {
    backgroundColor: isDark ? t.colors.surfaceRaised : t.colors.night,
    borderRadius: t.radii.card,
    padding: t.space[4],
    gap: t.space[2],
    borderWidth: isDark ? t.borderWidth.hairline : 0,
    borderColor: t.colors.hairline,
    borderLeftWidth: t.borderWidth.thick,
    borderLeftColor: t.colors.primary,
  };
  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const eyebrowRow: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[2] };
  const eyebrow: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.accent };
  const headline: TextStyle = {
    ...(type.heading as unknown as TextStyle),
    color: fg,
  };
  const body: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: fgSoft,
  };
  const dismiss: ViewStyle = {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  };

  return (
    <View style={card}>
      <View style={headerRow}>
        <View style={eyebrowRow}>
          <Ionicons name="sparkles-outline" size={14} color={t.colors.accent} />
          <Text style={eyebrow}>EYE-OPENING DISCOVERY</Text>
        </View>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss discovery"
          hitSlop={8}
          style={dismiss}
        >
          <Ionicons name="close" size={18} color={fgSoft} />
        </Pressable>
      </View>

      <Text style={headline}>{insight.headline}</Text>

      <Text style={body}>
        Based on your last {n} completed {categoryName.toLowerCase()} {n === 1 ? 'task' : 'tasks'},
        you run about {insight.multiplier.toFixed(1)}×. No guilt — your brain thinks fast, execution
        just takes longer.
      </Text>
    </View>
  );
}
