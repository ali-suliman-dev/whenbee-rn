import { View, type ViewStyle } from 'react-native';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { categoryName } from './categoryName';
import { CATEGORY_NAMES } from '@/src/engine';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// CategoryChips — single-select category picker shared by Retro + Add Task.
// Sources the tracked categories from categoriesStore; if the user hasn't set
// any yet (e.g. onboarding incomplete), falls back to the canonical seed set so
// the sheet is never empty.
// ──────────────────────────────────────────────────────────────────────────────

export interface PickerCategory {
  id: string;
  name: string;
  adaptSpeed: AdaptSpeed;
}

const SEED_FALLBACK: PickerCategory[] = Object.keys(CATEGORY_NAMES).map((id) => ({
  id,
  name: CATEGORY_NAMES[id] ?? id,
  adaptSpeed: 'balanced',
}));

/** Tracked categories, or the seed set if none are configured. */
export function usePickerCategories(): PickerCategory[] {
  const tracked = useCategoriesStore((s) => s.categories);
  if (tracked.length === 0) return SEED_FALLBACK;
  return tracked.map((c) => ({ id: c.id, name: c.name || categoryName(c.id), adaptSpeed: c.adaptSpeed }));
}

export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: PickerCategory[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = useTheme();
  const row: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2] };

  return (
    <View style={row}>
      {categories.map((c) => (
        <Chip key={c.id} label={c.name} selected={value === c.id} onPress={() => onChange(c.id)} />
      ))}
    </View>
  );
}
