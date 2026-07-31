// TDD: complete() must never leave the tracked category list empty. Skip is gone,
// but belt-and-braces: nothing else in the app can write an empty tracked list —
// calibrationStore.hydrate iterates only tracked categories, so an empty list
// means statsByCategory stays {} forever and the honest number never learns.

import { renderHook, act } from '@testing-library/react-native';
import { useOnboarding } from '../useOnboarding';
import { DEFAULT_CATEGORY_IDS } from '../categories';
import { useOnboardingStore } from '@/src/stores/onboardingStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';

beforeEach(() => {
  useOnboardingStore.getState().reset();
  useCategoriesStore.getState().reset();
});

describe('complete() category floor', () => {
  it('never writes an empty tracked list', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.complete();
    }); // nothing picked
    expect(useCategoriesStore.getState().categories.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the default set when nothing was picked', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.complete();
    });
    expect(useCategoriesStore.getState().categories.map((c) => c.id)).toEqual([
      ...DEFAULT_CATEGORY_IDS,
    ]);
  });

  it('keeps the user picks when there are any', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.togglePick({ id: 'cooking', name: 'Cooking' });
    });
    act(() => {
      result.current.complete();
    });
    expect(useCategoriesStore.getState().categories.map((c) => c.id)).toEqual(['cooking']);
  });
});
