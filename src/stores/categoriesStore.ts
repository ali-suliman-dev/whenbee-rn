import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import type { AdaptSpeed } from '@/src/domain/types';

export interface CategoryEntry {
  id: string;
  name: string;
  adaptSpeed: AdaptSpeed;
}

interface CategoriesState {
  categories: CategoryEntry[];
  setCategories: (list: CategoryEntry[]) => void;
  setAdaptSpeed: (id: string, speed: AdaptSpeed) => void;
  /** Add a custom category from a free-text name. Returns its slug id (existing
   *  id if a category with the same slug is already tracked — no duplicates). */
  addCategory: (name: string) => string;
  /** Rename a tracked category's display name. The id (and any logged stats keyed
   *  to it) stays put — only the label the user sees changes. No-op on blank. */
  renameCategory: (id: string, name: string) => void;
  /** Stop tracking a category. Past logs and stats are untouched; it just leaves
   *  the tracked list. Refuses to remove the last one (the app needs at least one). */
  removeCategory: (id: string) => void;
  /** Wipe the tracked list back to empty (full data-reset path). */
  reset: () => void;
}

/** Lowercase, underscore-joined slug for a free-text category name. */
export function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set, get) => ({
      categories: [],
      setCategories: (categories) => set({ categories }),
      addCategory: (name) => {
        const id = slugifyCategory(name) || `cat_${name.length}`;
        const existing = get().categories.find((c) => c.id === id);
        if (existing) return existing.id;
        const entry: CategoryEntry = { id, name: name.trim(), adaptSpeed: 'balanced' };
        set((state) => ({ categories: [...state.categories, entry] }));
        return id;
      },
      setAdaptSpeed: (id, speed) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, adaptSpeed: speed } : c,
          ),
        })),
      renameCategory: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
        }));
      },
      removeCategory: (id) =>
        set((state) =>
          state.categories.length <= 1
            ? state
            : { categories: state.categories.filter((c) => c.id !== id) },
        ),
      reset: () => set({ categories: [] }),
    }),
    { name: 'categories', storage: createJSONStorage(() => zustandKv) },
  ),
);
