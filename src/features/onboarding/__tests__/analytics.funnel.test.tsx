// TDD: onboarding/activation funnel analytics — once-guard logic and event routing.
//
// Tests in this file verify that:
//  1. trackWelcomeShown / trackCategoriesCommitted are exposed and fire the right event.
//  2. trackQuizStarted / trackRevealShown are exposed and fire the right event.
//  3. name_set fires with the correct length; name_skipped fires for empty/undefined.
//  4. The events are typed (TypeScript compile-time, confirmed by calling capture through
//     the typed hook interface without casting).
//
// Thin emit tests — the once-guard for screen-level refs is tested in the screen
// integration tests (welcomeScreen.test.tsx etc.). Here we test the hook layer.

import { renderHook, act, render, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useOnboarding } from '../useOnboarding';
import { usePersonalize } from '../usePersonalize';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { analytics } from '@/src/services/analytics';
import Ready from '@/src/app/(onboarding)/ready';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

// Spy on analytics.capture — fire-and-forget, no network.
const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});

beforeEach(() => {
  captureSpy.mockClear();
  (router.replace as jest.Mock).mockClear();
  useOnboardingStore.setState({ completed: false, picked: [] });
  useSettingsStore.getState().reset();
});

afterAll(() => {
  captureSpy.mockRestore();
});

// ── useOnboarding analytics ────────────────────────────────────────────────────

describe('useOnboarding — funnel events', () => {
  it('trackWelcomeShown fires welcome_shown', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.trackWelcomeShown());
    expect(captureSpy).toHaveBeenCalledWith('welcome_shown');
  });

  it('trackCategoriesCommitted fires categories_committed with categories_picked count', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.togglePick({ id: 'cleaning', name: 'Cleaning' });
      result.current.togglePick({ id: 'admin', name: 'Admin & email' });
    });
    act(() => result.current.trackCategoriesCommitted());
    expect(captureSpy).toHaveBeenCalledWith('categories_committed', { categories_picked: 2 });
  });

  it('trackCategoriesCommitted reflects the live picked count', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => result.current.togglePick({ id: 'errands', name: 'Errands' }));
    act(() => result.current.trackCategoriesCommitted());
    expect(captureSpy).toHaveBeenCalledWith('categories_committed', { categories_picked: 1 });
  });
});

// ── usePersonalize analytics ────────────────────────────────────────────────────

describe('usePersonalize — funnel events', () => {
  it('trackQuizStarted fires quiz_started', () => {
    const { result } = renderHook(() => usePersonalize());
    act(() => result.current.trackQuizStarted());
    expect(captureSpy).toHaveBeenCalledWith('quiz_started');
  });

  it('trackRevealShown fires reveal_shown', () => {
    const { result } = renderHook(() => usePersonalize());
    act(() => result.current.trackRevealShown());
    expect(captureSpy).toHaveBeenCalledWith('reveal_shown');
  });

  it('trackQuizCompleted fires quiz_completed with the archetype, and saveQuiz alone does not', () => {
    const { result } = renderHook(() => usePersonalize());
    act(() => { result.current.saveQuiz({ pace: 'lot', mid: 'rabbit' }); });
    // saveQuiz is a data write — it must NOT own the event (moved to callers so a
    // re-mounted reveal screen doesn't silently double-count the funnel).
    expect(captureSpy).not.toHaveBeenCalledWith('quiz_completed', expect.anything());
    act(() => result.current.trackQuizCompleted({ archetype: 'The Dreamer' }));
    expect(captureSpy).toHaveBeenCalledWith('quiz_completed', { archetype: 'The Dreamer' });
  });

  it('saveName fires name_set with string length when a non-empty name is given', () => {
    const { result } = renderHook(() => usePersonalize());
    act(() => result.current.saveName('Jordan'));
    expect(captureSpy).toHaveBeenCalledWith('name_set', { length: 6 });
    expect(captureSpy).not.toHaveBeenCalledWith('name_skipped');
  });

  it('saveName fires name_skipped when name is undefined', () => {
    const { result } = renderHook(() => usePersonalize());
    act(() => result.current.saveName(undefined));
    expect(captureSpy).toHaveBeenCalledWith('name_skipped');
    expect(captureSpy).not.toHaveBeenCalledWith('name_set', expect.anything());
  });

  it('saveName fires name_skipped when name is empty string (trimmed to undefined by caller)', () => {
    const { result } = renderHook(() => usePersonalize());
    // The Ready screen passes `nickname.trim() || undefined`, so the hook receives undefined.
    // Confirm the hook correctly fires name_skipped for undefined.
    act(() => result.current.saveName(undefined));
    expect(captureSpy).toHaveBeenCalledWith('name_skipped');
  });
});

// ── double-tap guard: onboarding_completed must count once, not once per tap ───
// router.push/replace does not dedupe a double-tap, so the terminal CTA is the
// one place a re-fire would silently inflate activation numbers. useOnce guards
// it — this is the end-to-end regression for that fix.

describe('double-tap does not double-count onboarding_completed', () => {
  it('counts one completion per user, not one per tap', () => {
    render(<Ready />);
    const cta = screen.getByText(/Time my first thing/);
    fireEvent.press(cta);
    fireEvent.press(cta);
    expect(captureSpy).toHaveBeenCalledWith('onboarding_completed', expect.anything());
    expect(
      captureSpy.mock.calls.filter(([event]) => event === 'onboarding_completed'),
    ).toHaveLength(1);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});
