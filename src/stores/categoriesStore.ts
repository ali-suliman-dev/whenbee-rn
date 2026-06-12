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
}

export const useCategoriesStore = create<CategoriesState>()(
  persist(
    (set) => ({
      categories: [],
      setCategories: (categories) => set({ categories }),
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
