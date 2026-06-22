import { useOnboardingStore, quizComplete, QUIZ_STEPS } from '@/src/stores/onboardingStore';

describe('onboardingStore — quiz answers', () => {
  beforeEach(() => {
    useOnboardingStore.getState().clearQuiz();
  });

  it('starts empty', () => {
    expect(useOnboardingStore.getState().quizAnswers).toEqual({});
    expect(quizComplete({})).toBe(false);
  });

  it('accumulates answers across steps and survives overwrite', () => {
    const s = useOnboardingStore.getState();
    s.setQuizAnswer('pace', 'bit');
    expect(useOnboardingStore.getState().quizAnswers.pace).toBe('bit');
    expect(quizComplete(useOnboardingStore.getState().quizAnswers)).toBe(true);

    s.setQuizAnswer('mid', 'track');
    expect(Object.keys(useOnboardingStore.getState().quizAnswers)).toHaveLength(2);

    s.setQuizAnswer('pace', 'lot'); // overwrite (back-nav re-answer)
    expect(useOnboardingStore.getState().quizAnswers.pace).toBe('lot');
    expect(Object.keys(useOnboardingStore.getState().quizAnswers)).toHaveLength(2);
  });

  it('clearQuiz resets', () => {
    const s = useOnboardingStore.getState();
    s.setQuizAnswer('pace', 'bit');
    s.clearQuiz();
    expect(useOnboardingStore.getState().quizAnswers).toEqual({});
  });

  it('QUIZ_STEPS is the ordered set of question keys', () => {
    expect(QUIZ_STEPS).toEqual(['pace', 'mid', 'focus']);
  });
});
