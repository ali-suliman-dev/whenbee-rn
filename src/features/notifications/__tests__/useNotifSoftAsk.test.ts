// TDD: useNotifSoftAsk — show-predicate and state-machine integration.
// Mocks the timerNotifications service and calibrationStore.
// jest.mock() calls are hoisted by Babel so the import order below is safe.

import { renderHook, act } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useNotifSoftAsk } from '../useNotifSoftAsk';

// ── service mocks ──────────────────────────────────────────────────────────────

const mockGetPermStatus = jest.fn<Promise<'granted' | 'denied' | 'undetermined'>, []>();
const mockEnsurePerm = jest.fn<Promise<boolean>, []>();

jest.mock('@/src/services/timerNotifications', () => ({
  getNotificationPermissionStatus: () => mockGetPermStatus(),
  ensureNotificationPermission: () => mockEnsurePerm(),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

/** Set up the test environment for a "should show" scenario. */
function setupShowEnv() {
  useCalibrationStore.setState({ logs: 1 });
  mockGetPermStatus.mockResolvedValue('undetermined');
  // kv is clean (default pending state).
}

beforeEach(() => {
  kv.clearAll();
  mockGetPermStatus.mockReset();
  mockEnsurePerm.mockReset();
  mockEnsurePerm.mockResolvedValue(true);
  // Reset logs to 0 (no calibrations yet).
  useCalibrationStore.setState({ logs: 0 });
});

// ── show predicate ─────────────────────────────────────────────────────────────

describe('useNotifSoftAsk — show predicate', () => {
  it('shows when: first calibration (logs=1) + pending + undetermined', async () => {
    setupShowEnv();
    const { result } = renderHook(() => useNotifSoftAsk());

    // Initially hidden while async status loads.
    expect(result.current.show).toBe(false);

    // Wait for permission status to resolve.
    await act(async () => {});

    expect(result.current.show).toBe(true);
  });

  it('does NOT show when logs=0 (no calibration yet)', async () => {
    useCalibrationStore.setState({ logs: 0 });
    mockGetPermStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when logs=2 (not first calibration)', async () => {
    useCalibrationStore.setState({ logs: 2 });
    mockGetPermStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when permission is already granted', async () => {
    useCalibrationStore.setState({ logs: 1 });
    mockGetPermStatus.mockResolvedValue('granted');

    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
  });

  it('does NOT show when permission is denied', async () => {
    useCalibrationStore.setState({ logs: 1 });
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
