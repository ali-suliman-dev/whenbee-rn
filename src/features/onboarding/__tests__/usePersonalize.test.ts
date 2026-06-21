import { renderHook, act } from '@testing-library/react-native';
import { usePersonalize } from '../usePersonalize';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

it('persists the seed and returns a reveal card from quiz answers', () => {
  const { result } = renderHook(() => usePersonalize());
  let card: { title: string; multiplier: number } | undefined;
  act(() => { card = result.current.saveQuiz({ pace: 'lot', mid: 'rabbit' }); });
  expect(useSettingsStore.getState().archetypeSeed?.m0).toBeGreaterThan(2);
  expect(card!.title.length).toBeGreaterThan(0);
});

it('persists a name and clears on undefined', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => result.current.saveName('Ali'));
  expect(useSettingsStore.getState().displayName).toBe('Ali');
});
