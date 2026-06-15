import { renderHook, act } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// In-memory kv so the round-trip is observable without expo-sqlite.
const mockStore = new Map<string, string>();
jest.mock('@/src/lib/kv', () => ({
  kv: {
    set: (k: string, v: string) => void mockStore.set(k, v),
    getString: (k: string): string | null => mockStore.get(k) ?? null,
    delete: (k: string) => void mockStore.delete(k),
  },
}));

const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

/* eslint-disable import/first */
import {
  useFounderReserve,
  FOUNDER_RESERVED_KEY,
  FOUNDER_RESERVED_AT_KEY,
} from '../useFounderReserve';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
});

describe('useFounderReserve', () => {
  it('starts unreserved when no flag is persisted', () => {
    const { result } = renderHook(() => useFounderReserve());
    expect(result.current.reserved).toBe(false);
  });

  it('reserve() persists the flag, records a timestamp, and fires founder_reserve', () => {
    const { result } = renderHook(() => useFounderReserve());

    act(() => result.current.reserve());

    expect(result.current.reserved).toBe(true);
    expect(mockStore.get(FOUNDER_RESERVED_KEY)).toBe('1');
    expect(mockStore.has(FOUNDER_RESERVED_AT_KEY)).toBe(true);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('founder_reserve', { result: 'reserved' });
  });

  it('round-trips: a fresh hook reads the persisted flag back as reserved', () => {
    // First session reserves the price.
    const first = renderHook(() => useFounderReserve());
    act(() => first.result.current.reserve());
    expect(mockStore.get(FOUNDER_RESERVED_KEY)).toBe('1');

    // A later session (fresh hook) must read that persisted flag back.
    const { result } = renderHook(() => useFounderReserve());
    expect(result.current.reserved).toBe(true);
  });

  it('is idempotent: a second reserve() does not re-write or re-fire analytics', () => {
    const { result } = renderHook(() => useFounderReserve());

    act(() => result.current.reserve());
    const firstAt = mockStore.get(FOUNDER_RESERVED_AT_KEY);
    act(() => result.current.reserve());

    expect(mockCapture).toHaveBeenCalledTimes(1);
    // The timestamp is not overwritten on the repeat tap.
    expect(mockStore.get(FOUNDER_RESERVED_AT_KEY)).toBe(firstAt);
    expect(result.current.reserved).toBe(true);
  });
});
