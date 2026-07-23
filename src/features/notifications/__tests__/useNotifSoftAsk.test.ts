// TDD: useNotifSoftAsk — show-predicate and state-machine integration.
// Mocks the timerNotifications service and calibrationStore.
// jest.mock() calls are hoisted by Babel so the import order below is safe.

import { renderHook, act } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useNotifSoftAsk } from '../useNotifSoftAsk';

// ── service mocks ──────────────────────────────────────────────────────────────

const mockGetPermStatus = jest.fn<Promise<'granted' | 'denied' | 'undetermined'>, []>();
const mockEnsurePerm = jest.fn<Promise<boolean>, []>();

jest.mock('@/src/services/timerNotifications', () => ({
  getNotificationPermissionStatus: () => mockGetPermStatus(),
  ensureNotificationPermission: () => mockEnsurePerm(),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ReclaimSummary stub with the given lifetimeNectar value. */
function makeReclaimSummary(lifetimeNectar: number) {
  return {
    lifetimeMin: 0,
    byCategory: [],
    biggestArea: null,
    honestLogCount: lifetimeNectar,
    companion: {
      stage: 1 as const,
      capability: 'timer' as const,
      keeper: false,
      lifetimeNectar,
      driftHealth: 'settled' as const,
      seed: 1,
      name: null,
    },
    discoveryCount: 0,
  };
}

/** Set up the test environment for a "should show" scenario. */
function setupShowEnv(lifetimeNectar = 1) {
  const mockLoadReclaimSummary = jest.fn().mockResolvedValue(makeReclaimSummary(lifetimeNectar));
  useCalibrationStore.setState({ loadReclaimSummary: mockLoadReclaimSummary });
  mockGetPermStatus.mockResolvedValue('undetermined');
  // kv is clean (default pending state).
}

beforeEach(() => {
  kv.clearAll();
  mockGetPermStatus.mockReset();
  mockEnsurePerm.mockReset();
  mockEnsurePerm.mockResolvedValue(true);
  useSettingsStore.setState({ remindersEnabled: false });
  // Default: lifetime = 0 (no calibrations ever).
  const mockLoadReclaimSummary = jest.fn().mockResolvedValue(makeReclaimSummary(0));
  useCalibrationStore.setState({ loadReclaimSummary: mockLoadReclaimSummary });
});

// ── show predicate ─────────────────────────────────────────────────────────────

describe('useNotifSoftAsk — show predicate', () => {
  it('shows when: first calibration ever (lifetimeNectar=1) + pending + undetermined', async () => {
    setupShowEnv(1);
    const { result } = renderHook(() => useNotifSoftAsk());

    // Initially hidden while async status loads.
    expect(result.current.show).toBe(false);

    // Wait for permission status and lifetimeNectar to resolve.
    await act(async () => {});

    expect(result.current.show).toBe(true);
  });

  it('does NOT show when lifetimeNectar=0 (no calibration yet)', async () => {
    setupShowEnv(0);
    mockGetPermStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when lifetimeNectar=2 (not first calibration)', async () => {
    setupShowEnv(2);
    mockGetPermStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when permission is already granted', async () => {
    setupShowEnv(1);
    mockGetPermStatus.mockResolvedValue('granted');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when permission is denied', async () => {
    setupShowEnv(1);
    mockGetPermStatus.mockResolvedValue('denied');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when status is already accepted', async () => {
    setupShowEnv();
    // Pre-set the KV to accepted.
    kv.set('whenbee.notifSoftAsk', 'accepted');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when status is already declined', async () => {
    setupShowEnv();
    kv.set('whenbee.notifSoftAsk', 'declined');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  // ── regression: session-restart bug ──────────────────────────────────────────
  // The old implementation used session-scoped `logs` (resets to 0 on boot).
  // On a fresh session the user completes their SECOND-ever calibration, so
  // session-logs reads 1 — but lifetime is 2. The card must NOT show.
  it('regression — session restart: does NOT show on 2nd-ever calibration (lifetime=2, pending)', async () => {
    // Simulate: user has 2 lifetime calibrations, notifSoftAsk still 'pending'
    // (they never responded in the first session), permission still undetermined.
    const mockLoadReclaimSummary = jest.fn().mockResolvedValue(makeReclaimSummary(2));
    useCalibrationStore.setState({ loadReclaimSummary: mockLoadReclaimSummary });
    mockGetPermStatus.mockResolvedValue('undetermined');
    // KV is clean → status is 'pending' (default).

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });
});

// ── actions ───────────────────────────────────────────────────────────────────

describe('useNotifSoftAsk — actions', () => {
  it('onAccept hides the card and calls ensureNotificationPermission', async () => {
    setupShowEnv();
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(true);

    await act(async () => { await result.current.onAccept(); });

    expect(result.current.show).toBe(false);
    expect(mockEnsurePerm).toHaveBeenCalledTimes(1);
    // KV persists the accepted state.
    expect(kv.getString('whenbee.notifSoftAsk')).toBe('accepted');
  });

  // Regression (2026-07-23): accepting the soft-ask granted the OS permission but
  // never flipped the app's master remindersEnabled setting — so the promised
  // "gentle nudge when a timer ends" never fired and Settings showed Reminders OFF.
  it('onAccept turns the master Reminders setting ON when the OS grants permission', async () => {
    setupShowEnv();
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(useSettingsStore.getState().remindersEnabled).toBe(true);
  });

  it('onAccept leaves Reminders OFF when the OS denies permission', async () => {
    setupShowEnv();
    mockEnsurePerm.mockResolvedValue(false);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(useSettingsStore.getState().remindersEnabled).toBe(false);
  });

  it('onDecline hides the card and does NOT call ensureNotificationPermission', async () => {
    setupShowEnv();
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(true);

    act(() => { result.current.onDecline(); });

    expect(result.current.show).toBe(false);
    expect(mockEnsurePerm).not.toHaveBeenCalled();
    expect(kv.getString('whenbee.notifSoftAsk')).toBe('declined');
  });

  it('after accepted, a fresh hook render never shows again', async () => {
    setupShowEnv();
    const first = renderHook(() => useNotifSoftAsk());
    await act(async () => {});
    await act(async () => { await first.result.current.onAccept(); });
    first.unmount();

    // Simulate re-mount (new screen visit after returning from the hub).
    const second = renderHook(() => useNotifSoftAsk());
    await act(async () => {});
    expect(second.result.current.show).toBe(false);
  });

  it('after declined, a fresh hook render never shows again', async () => {
    setupShowEnv();
    const first = renderHook(() => useNotifSoftAsk());
    await act(async () => {});
    act(() => { first.result.current.onDecline(); });
    first.unmount();

    const second = renderHook(() => useNotifSoftAsk());
    await act(async () => {});
    expect(second.result.current.show).toBe(false);
  });
});
