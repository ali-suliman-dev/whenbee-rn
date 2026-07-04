import { useForgotStore } from '../forgotStore';
import type { PendingAutoClose } from '@/src/domain/types';

const sample: PendingAutoClose = {
  taskLabel: 'Deep work',
  category: 'Work',
  guessMin: 40,
  honestMin: 50,
  startedAt: 1_000_000,
  elapsedMin: 300,
  recoveredActualMin: 50,
};

describe('forgotStore', () => {
  beforeEach(() => useForgotStore.getState().clear());

  it('starts empty', () => {
    expect(useForgotStore.getState().pending).toBeNull();
  });

  it('setPending / clear round-trip', () => {
    useForgotStore.getState().setPending(sample);
    expect(useForgotStore.getState().pending?.category).toBe('Work');
    useForgotStore.getState().clear();
    expect(useForgotStore.getState().pending).toBeNull();
  });
});
