// Re-take modal (Settings / Whenbee Hub "retake the quiz" entry). saveQuiz no
// longer owns quiz_completed (see analytics.funnel.test.tsx / revealScreen.test.tsx
// for onboarding's own guard) — this confirms the retake path still fires it
// itself, so moving the capture out of saveQuiz didn't silently drop this event.
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ArchetypeQuizModal from '@/src/app/(modals)/archetype-quiz';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});

beforeEach(() => {
  captureSpy.mockClear();
  (router.back as jest.Mock).mockClear();
  useSettingsStore.getState().reset();
});

afterAll(() => {
  captureSpy.mockRestore();
});

it('completing the quiz from the re-take modal fires quiz_completed', () => {
  const { getByText } = render(<ArchetypeQuizModal />);
  fireEvent.press(getByText('A bit longer'));
  fireEvent.press(getByText('See my type'));
  expect(captureSpy).toHaveBeenCalledWith('quiz_completed', expect.objectContaining({ archetype: expect.any(String) }));
  expect(captureSpy).toHaveBeenCalledWith('archetype_reopened');
});
