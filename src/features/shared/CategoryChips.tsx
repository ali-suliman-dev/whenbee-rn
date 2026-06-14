import { useMemo } from 'react';
import { ScrollView, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { categoryName } from './categoryName';
import { sortPickerCategories } from './categoryGuess';
import { CATEGORY_NAMES } from '@/src/engine';
import type { AdaptSpeed } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// CategoryChips — single-select category picker shared by Retro + Add Task.
//
// Layout: ONE horizontal scroll row (was a 4-row wrap that ate ~280px). The row
// is frequency-sorted — your most-used categories lead, the rest scroll right and
// the partially-cut trailing chip signals "more". An optional title-`guessedId`
// floats to the front, pre-selected, and wears a ✦ so the smart pick reads as a
// helpful default the user can override with one tap (no penalty, no guilt).
//
// Seeds are trimmed to a focused six; previously-used and custom categories are
// still merged in (so trimming can never hide a category you actually track).
// ──────────────────────────────────────────────────────────────────────────────

export interface PickerCategory {
  id: string;
  name: string;
  adaptSpeed: AdaptSpeed;
}

// Focused default set shown to a fresh user. The engine still knows every id
// (email/writing/calls/commute live in CATEGORY_NAMES); they just aren't loud
// defaults — they reappear here once used, and "+ New" covers the long tail.
const SEED_IDS = ['admin', 'errands', 'cleaning', 'cooking', 'creative', 'getting_ready'];

const SEED: PickerCategory[] = SEED_IDS.map((id) => ({
  id,
  name: CATEGORY_NAMES[id] ?? id,
  adaptSpeed: 'balanced',
}));

/** Seed six, plus any category the user has used (has stats) or tracked custom. */
export function usePickerCategories(): PickerCategory[] {
  const tracked = useCategoriesStore((s) => s.categories);
  const stats = useCalibrationStore((s) => s.statsByCategory);
  const byId = new Map<string, PickerCategory>();
  for (const c of SEED) byId.set(c.id, c);
  // Keep previously-used categories visible even if dropped from the seed display.
  for (const id of Object.keys(stats)) {
    if (!byId.has(id)) byId.set(id, { id, name: categoryName(id), adaptSpeed: 'balanced' });
  }
  // Tracked custom entries win their name/adaptSpeed.
  for (const c of tracked) {
    byId.set(c.id, { id: c.id, name: c.name || categoryName(c.id), adaptSpeed: c.adaptSpeed });
  }
  return Array.from(byId.values());
}

export function CategoryChips({
  categories,
  value,
  onChange,
  onAddNew,
  guessedId = null,
  usage,
}: {
  categories: PickerCategory[];
  value: string | null;
  onChange: (id: string) => void;
  /** When provided, renders a trailing "+ New" chip that triggers inline create. */
  onAddNew?: () => void;
  /** Category id auto-guessed from the task title — floated first and marked ✦. */
  guessedId?: string | null;
  /** Per-category usage counts; drives the frequency sort of the row. */
  usage?: Record<string, number>;
}) {
  const t = useTheme();

  const sorted = useMemo(
    () => sortPickerCategories(categories, usage ?? {}, guessedId),
    [categories, usage, guessedId],
  );

  // Trailing pad so the last chip clears the edge and a partial chip can peek.
  const content: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    paddingRight: t.space[4],
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={content}
    >
      {sorted.map((c) => (
        <Chip
          key={c.id}
          label={c.name}
          selected={value === c.id}
          icon={
            c.id === guessedId ? (
              <Ionicons name="bulb-outline" size={t.iconSize.sm} color={t.colors.primary} />
            ) : undefined
          }
          onPress={() => onChange(c.id)}
        />
      ))}
      {onAddNew ? (
        <Chip
          label="New"
          variant="add"
          icon={<Ionicons name="add" size={t.iconSize.sm} color={t.colors.inkSoft} />}
          onPress={onAddNew}
        />
      ) : null}
    </ScrollView>
  );
}
