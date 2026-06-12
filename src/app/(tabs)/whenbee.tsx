import { View, Text, Pressable, ScrollView, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { CATEGORY_NAMES } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Whenbee hub — companion + honeycomb surface.
//
// PLACEHOLDER QUALITY: the avatar, full honeycomb, and tier trail land in a later
// phase. What's wired now: per-category rows (`.catrow`) that drill into the
// Category Detail / Tune screen via router.push('/category/[category]'), so the
// calibration learning is reachable and inspectable.
// ──────────────────────────────────────────────────────────────────────────────

function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Whenbee() {
  const t = useTheme();
  const categories = useCategoriesStore((s) => s.categories);
  const stats = useCalibrationStore((s) => s.statsByCategory);

  function openCategory(id: string) {
    router.push({ pathname: '/category/[category]', params: { category: id } });
  }

  const sectionLabel: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: t.space[4], paddingTop: t.space[4], paddingBottom: t.space[12] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: t.space[2] }}>
          <AppText variant="display">Whenbee</AppText>
          <AppText variant="body">Your honeycomb and the patterns behind it.</AppText>
        </View>

        {categories.length > 0 ? (
          <View style={{ gap: t.space[3] }}>
            <Text style={sectionLabel}>IN THE BACKGROUND</Text>
            {categories.map((cat) => {
              const mult = stats[cat.id]?.mEffective;
              return (
                <CategoryRow
                  key={cat.id}
                  name={categoryLabel(cat.id)}
                  multiplier={mult}
                  onPress={() => openCategory(cat.id)}
                />
              );
            })}
          </View>
        ) : (
          <AppText variant="caption">
            Track a few tasks and your categories will appear here.
          </AppText>
        )}
      </ScrollView>
    </Screen>
  );
}

function CategoryRow({
  name,
  multiplier,
  onPress,
}: {
  name: string;
  multiplier: number | undefined;
  onPress: () => void;
}) {
  const t = useTheme();
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    minHeight: 56,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    borderRadius: t.radii.lg,
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[3],
  };
  const nameText: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink, flex: 1 };
  const multText: TextStyle = {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: t.colors.primary,
    fontVariant: ['tabular-nums'],
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} insights`}
      style={({ pressed }) => [row, pressed ? { opacity: 0.85 } : null]}
    >
      <Text style={nameText}>{name}</Text>
      {multiplier !== undefined ? <Text style={multText}>{multiplier.toFixed(1)}×</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={t.colors.inkSoft} />
    </Pressable>
  );
}
