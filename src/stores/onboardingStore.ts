import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandKv } from '@/src/lib/kv';
import type { QuizAnswers } from '@/src/engine';

/** A category the user picked during onboarding (seed or custom). */
export interface PickedCategory {
  id: string;
  name: string;
}

/** Ordered time-style quiz steps. `pace` is required; `mid`/`focus` enrich.
 *  The per-step quiz routes (`quiz/[step]`) index into this. */
export const QUIZ_STEPS = ['pace', 'mid', 'focus'] as const satisfies readonly (keyof QuizAnswers)[];

interface OnboardingState {
  /** The boot gate flag. `hasOnboarded` is its public alias. */
  completed: boolean;
  hydrated: boolean;
  /** Categories selected on Step 1, in pick order. */
  picked: PickedCategory[];
  togglePick: (cat: PickedCategory) => void;
  /** Accumulated time-style quiz answers, written one step at a time. */
  quizAnswers: Partial<QuizAnswers>;
  /** Records (or overwrites) one quiz answer; survives back-navigation. */
  setQuizAnswer: <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => void;
  /** Clears all quiz answers (re-take / reset). */
  clearQuiz: () => void;
  /** Marks onboarding done (sets the boot-gate flag). */
  complete: () => void;
  /** Flips the hydration gate once persisted state has been read. */
  setHydrated: () => void;
  /** Test/reset helper — clears selection + flag. */
  reset: () => void;
}

/** True once the required `pace` answer exists — the reveal gate. */
export function quizComplete(answers: Partial<QuizAnswers>): boolean {
  return answers.pace !== undefined;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      hydrated: false,
      picked: [],
      quizAnswers: {},
      togglePick: (cat) =>
        set((state) => {
          const exists = state.picked.some((p) => p.id === cat.id);
          return {
            picked: exists
              ? state.picked.filter((p) => p.id !== cat.id)
              : [...state.picked, cat],
          };
        }),
      setQuizAnswer: (key, value) =>
        set((state) => ({ quizAnswers: { ...state.quizAnswers, [key]: value } })),
      clearQuiz: () => set({ quizAnswers: {} }),
      complete: () => set({ completed: true }),
      setHydrated: () => set({ hydrated: true }),
      reset: () => set({ completed: false, picked: [], quizAnswers: {} }),
    }),
    {
      name: 'onboarding',
      storage: createJSONStorage(() => zustandKv),
      // Boot-gate flag + picks + in-progress quiz answers survive a relaunch.
      partialize: (s) => ({ completed: s.completed, picked: s.picked, quizAnswers: s.quizAnswers }),
      // Storage is synchronous, so this runs during create() — call the action
      // via the captured state, never the still-uninitialized store const (TDZ).
      onRehydrateStorage: (state) => () => state.setHydrated(),
    },
  ),
);
