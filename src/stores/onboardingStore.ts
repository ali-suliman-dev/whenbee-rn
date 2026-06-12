import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';

interface OnboardingState { completed: boolean; hydrated: boolean; complete: () => void; }

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({ completed: false, hydrated: false, complete: () => set({ completed: true }) }),
    {
      name: 'onboarding',
      storage: createJSONStorage(() => zustandKv),
      onRehydrateStorage: () => () => useOnboardingStore.setState({ hydrated: true }),
    },
  ),
);
