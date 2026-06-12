import { renderHook, act } from '@testing-library/react-native';
import { useOnboarding } from '../useOnboarding';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';

describe('useOnboarding.complete (finish wiring)', () => {
  beforeEach(() => {
    useOnboardingStore.setState({ completed: false, picked: [] });
    useCategoriesStore.setState({ categories: [] });
  });

  it('persists the picked categories and sets the onboarded flag', () => {
    const { result } = renderHook(() => useOnboarding());

    act(() => {
      result.current.togglePick({ id: 'cleaning', name: 'Cleaning' });
      result.current.togglePick({ id: 'admin', name: 'Admin & email' });
    });

    act(() => {
      result.current.complete();
    });

    expect(useCategoriesStore.getState().categories).toEqual([
      { id: 'cleaning', name: 'Cleaning', adaptSpeed: 'balanced' },
      { id: 'admin', name: 'Admin & email', adaptSpeed: 'balanced' },
    ]);
    expect(useOnboardingStore.getState().completed).toBe(true);
  });
});
