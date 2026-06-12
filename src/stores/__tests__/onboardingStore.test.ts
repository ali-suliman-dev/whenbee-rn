import { useOnboardingStore } from '../onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => useOnboardingStore.setState({ completed: false }));
  it('starts incomplete', () => { expect(useOnboardingStore.getState().completed).toBe(false); });
  it('marks complete', () => { useOnboardingStore.getState().complete(); expect(useOnboardingStore.getState().completed).toBe(true); });
});
