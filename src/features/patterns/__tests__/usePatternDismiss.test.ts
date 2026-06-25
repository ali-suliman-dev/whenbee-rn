import { act, renderHook } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import { usePatternDismiss } from '../usePatternDismiss';

// ──────────────────────────────────────────────────────────────────────────────
// usePatternDismiss — durable kv-backed dismissal for Patterns insight cards.
//
// expo-sqlite/kv-store is mocked in jest.setup.js (in-memory Map). Because that
// Map persists across tests in the same module run, we clear it before each test.
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  kv.clearAll();
});

describe('usePatternDismiss', () => {
  it('starts undismissed when no kv entry exists', () => {
    const { result } = renderHook(() => usePatternDismiss('drift:admin:2024-W01'));
    expect(result.current.dismissed).toBe(false);
  });

  it('dismiss() sets dismissed=true immediately', () => {
    const { result } = renderHook(() => usePatternDismiss('drift:admin:2024-W01'));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
  });

  it('persists the dismissed id to kv', () => {
    const { result } = renderHook(() => usePatternDismiss('surprise:admin:2024-W01'));

    act(() => {
      result.current.dismiss();
    });

    // The kv key holds a JSON array of dismissed ids.
    const raw = kv.getString('patterns-dismissed');
    expect(raw).not.toBeNull();
    const ids = JSON.parse(raw!) as string[];
    expect(ids).toContain('surprise:admin:2024-W01');
  });

  it('a card with a different id is unaffected by another dismissal', () => {
    // Dismiss id X first.
    const { result: x } = renderHook(() => usePatternDismiss('surprise:admin:2024-W01'));
    act(() => { x.current.dismiss(); });

    // id Y is a fresh hook — should be undismissed.
    const { result: y } = renderHook(() => usePatternDismiss('experiment:global:2024-W01'));
    expect(y.current.dismissed).toBe(false);
  });

  it('re-mounting the hook with a dismissed id stays dismissed (reads kv on mount)', () => {
    // First hook dismisses the id.
    const { result: first } = renderHook(() => usePatternDismiss('drift:admin:2024-W01'));
    act(() => { first.current.dismiss(); });

    // Second hook (same id) is a fresh mount; should read kv and return dismissed=true.
    const { result: second } = renderHook(() => usePatternDismiss('drift:admin:2024-W01'));
    expect(second.current.dismissed).toBe(true);
  });

  it('a genuinely-new id (new content/period key) is not pre-dismissed', () => {
    // Dismiss week 01.
    const { result: w01 } = renderHook(() => usePatternDismiss('surprise:admin:2024-W01'));
    act(() => { w01.current.dismiss(); });

    // A new week (W02) has the same card type + category but different period.
    const { result: w02 } = renderHook(() => usePatternDismiss('surprise:admin:2024-W02'));
    expect(w02.current.dismissed).toBe(false);
  });
});
