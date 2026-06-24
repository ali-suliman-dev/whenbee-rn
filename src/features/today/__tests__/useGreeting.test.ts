import { renderHook } from '@testing-library/react-native';
import { useGreeting } from '../useGreeting';
import { useSettingsStore } from '@/src/stores/settingsStore';

beforeEach(() => useSettingsStore.getState().reset());

// --- useGreeting hook tests ---

it('returns a bare greeting lead with no name', () => {
  const { result } = renderHook(() => useGreeting());
  expect(result.current.lead).toMatch(/^Good (morning|afternoon|evening)$/);
  expect(result.current.name).toBeUndefined();
});

it('includes the name whenever one is set', () => {
  useSettingsStore.getState().setDisplayName('Ali');
  const { result } = renderHook(() => useGreeting());
  expect(result.current.name).toBe('Ali');
  expect(result.current.lead).toMatch(/^Good (morning|afternoon|evening)$/);
});
