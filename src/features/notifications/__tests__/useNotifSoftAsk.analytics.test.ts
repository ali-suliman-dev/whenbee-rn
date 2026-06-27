// TDD: useNotifSoftAsk — analytics event wiring.
//
// Verifies that:
//  1. notif_softask_shown fires exactly once when show first becomes true.
//  2. notif_softask_shown does NOT fire when the card never shows.
//  3. notif_softask_accepted fires on onAccept.
//  4. notif_softask_declined fires on onDecline.
//
// Mirrors the existing useNotifSoftAsk.test.ts setup so helpers are consistent.

import { renderHook, act } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { analytics } from '@/src/services/analytics';
import { useNotifSoftAsk } from '../useNotifSoftAsk';

// ── service mocks ──────────────────────────────────────────────────────────────

const mockGetPermStatus = jest.fn<Promise<'granted' | 'denied' | 'undetermined'>, []>();
const mockEnsurePerm = jest.fn<Promise<boolean>, []>();

jest.mock('@/src/services/timerNotifications', () => ({
  getNotificationPermissionStatus: () => mockGetPermStatus(),
  ensureNotificationPermission: () => mockEnsurePerm(),
}));

// ── analytics spy ──────────────────────────────────────────────────────────────

const captureSpy = jest.spyOn(analytics, 'capture').mockImplementation(() => {});

// ── helpers ───────────────────────────────────────────────────────────────────

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

function setupShowEnv(lifetimeNectar = 1) {
  const mockLoad = jest.fn().mockResolvedValue(makeReclaimSummary(lifetimeNectar));
  useCalibrationStore.setState({ loadReclaimSummary: mockLoad });
  mockGetPermStatus.mockResolvedValue('undetermined');
}

beforeEach(() => {
  kv.clearAll();
  captureSpy.mockClear();
  mockGetPermStatus.mockReset();
  mockEnsurePerm.mockReset();
  mockEnsurePerm.mockResolvedValue(true);
  // Default: lifetime = 0 (card does not show).
  const mockLoad = jest.fn().mockResolvedValue(makeReclaimSummary(0));
  useCalibrationStore.setState({ loadReclaimSummary: mockLoad });
});

afterAll(() => {
  captureSpy.mockRestore();
});

// ── shown event ───────────────────────────────────────────────────────────────

describe('useNotifSoftAsk — notif_softask_shown', () => {
  it('fires notif_softask_shown exactly once when card first becomes visible', async () => {
    setupShowEnv(1);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(true);
    const shownCalls = captureSpy.mock.calls.filter(([e]) => e === 'notif_softask_shown');
    expect(shownCalls).toHaveLength(1);
  });

  it('does NOT fire notif_softask_shown when card never shows (lifetimeNectar = 0)', async () => {
    setupShowEnv(0);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
    const shownCalls = captureSpy.mock.calls.filter(([e]) => e === 'notif_softask_shown');
    expect(shownCalls).toHaveLength(0);
  });

  it('does NOT fire notif_softask_shown when permission is already granted', async () => {
    setupShowEnv(1);
    mockGetPermStatus.mockResolvedValue('granted');
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(false);
    expect(captureSpy).not.toHaveBeenCalledWith('notif_softask_shown');
  });

  it('fires notif_softask_shown only once (once-guard on re-render)', async () => {
    setupShowEnv(1);
    const { result, rerender } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    expect(result.current.show).toBe(true);
    rerender({});
    await act(async () => {});

    const shownCalls = captureSpy.mock.calls.filter(([e]) => e === 'notif_softask_shown');
    expect(shownCalls).toHaveLength(1);
  });
});

// ── action events ─────────────────────────────────────────────────────────────

describe('useNotifSoftAsk — notif_softask_accepted', () => {
  it('fires notif_softask_accepted on onAccept', async () => {
    setupShowEnv(1);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(captureSpy).toHaveBeenCalledWith('notif_softask_accepted');
  });
});

describe('useNotifSoftAsk — notif_softask_declined', () => {
  it('fires notif_softask_declined on onDecline', async () => {
    setupShowEnv(1);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    act(() => { result.current.onDecline(); });

    expect(captureSpy).toHaveBeenCalledWith('notif_softask_declined');
  });

  it('does NOT fire notif_softask_accepted on decline', async () => {
    setupShowEnv(1);
    const { result } = renderHook(() => useNotifSoftAsk());
    await act(async () => {});

    act(() => { result.current.onDecline(); });

    expect(captureSpy).not.toHaveBeenCalledWith('notif_softask_accepted');
  });
});
