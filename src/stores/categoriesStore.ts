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
    }),
    { name: 'categories', storage: createJSONStorage(() => zustandKv) },
  ),
);
