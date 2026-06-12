import { useOnboardingStore } from '../onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => useOnboardingStore.setState({ completed: false, picked: [] }));

  it('starts incomplete with no picks', () => {
    expect(useOnboardingStore.getState().completed).toBe(false);
    expect(useOnboardingStore.getState().picked).toEqual([]);
  });

  it('marks complete', () => {
    useOnboardingStore.getState().complete();
    expect(useOnboardingStore.getState().completed).toBe(true);
  });

  it('toggles a pick on and off', () => {
    const cat = { id: 'cleaning', name: 'Cleaning' };
    useOnboardingStore.getState().togglePick(cat);
    expect(useOnboardingStore.getState().picked).toEqual([cat]);
    useOnboardingStore.getState().togglePick(cat);
    expect(useOnboardingStore.getState().picked).toEqual([]);
  });

  it('preserves pick order across multiple selections', () => {
    const a = { id: 'admin', name: 'Admin & email' };
    const b = { id: 'errands', name: 'Errands' };
    useOnboardingStore.getState().togglePick(a);
    useOnboardingStore.getState().togglePick(b);
    expect(useOnboardingStore.getState().picked.map((p) => p.id)).toEqual([
      'admin',
      'errands',
    ]);
  });

  // Regression: synchronous kv storage rehydrates during create(), so
  // onRehydrateStorage must flip `hydrated` via the captured state — referencing
  // the still-uninitialized store const (TDZ) silently left it false and hung
  // the boot screen on an infinite spinner.
  it('is hydrated synchronously after the store module loads', () => {
    expect(useOnboardingStore.getState().hydrated).toBe(true);
  });
});
