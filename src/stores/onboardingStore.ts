import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';

/** A category the user picked during onboarding (seed or custom). */
export interface PickedCategory {
  id: string;
  name: string;
}

interface OnboardingState {
  /** The boot gate flag. `hasOnboarded` is its public alias. */
  completed: boolean;
  hydrated: boolean;
  /** Categories selected on Step 1, in pick order. */
  picked: PickedCategory[];
  togglePick: (cat: PickedCategory) => void;
  /** Marks onboarding done (sets the boot-gate flag). */
  complete: () => void;
  /** Flips the hydration gate once persisted state has been read. */
  setHydrated: () => void;
  /** Test/reset helper — clears selection + flag. */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      hydrated: false,
      picked: [],
      togglePick: (cat) =>
        set((state) => {
          const exists = state.picked.some((p) => p.id === cat.id);
          return {
            picked: exists
              ? state.picked.filter((p) => p.id !== cat.id)
              : [...state.picked, cat],
          };
        }),
      complete: () => set({ completed: true }),
      setHydrated: () => set({ hydrated: true }),
      reset: () => set({ completed: false, picked: [] }),
    }),
    {
      name: 'onboarding',
      storage: createJSONStorage(() => zustandKv),
      // Only the boot-gate flag + picks need to survive a relaunch.
      partialize: (s) => ({ completed: s.completed, picked: s.picked }),
      // Storage is synchronous, so this runs during create() — call the action
      // via the captured state, never the still-uninitialized store const (TDZ).
      onRehydrateStorage: (state) => () => state.setHydrated(),
    },
  ),
);
