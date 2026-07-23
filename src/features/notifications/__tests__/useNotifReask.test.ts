// TDD: useNotifReask — drives the once-ever re-ask row on the reward screen
// after a declined soft-ask. Gate logic itself is pure-tested in reaskGate.test;
// this covers the hook's wiring: show predicate, one-shot budget spend on show,
// accept paths (granted = no OS prompt; overrun = prompt first), and legacy
// decline backfill.

import { renderHook, act } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import {
  recordNotifSoftAskDecline,
  setNotifSoftAsk,
  getNotifReaskMeta,
} from '../notifSoftAskState';
import { useNotifReask } from '../useNotifReask';

const mockGetPermStatus = jest.fn<Promise<'granted' | 'denied' | 'undetermined'>, []>();
const mockEnsurePerm = jest.fn<Promise<boolean>, []>();

jest.mock('@/src/services/timerNotifications', () => ({
  getNotificationPermissionStatus: () => mockGetPermStatus(),
  ensureNotificationPermission: () => mockEnsurePerm(),
}));

const DAY = 24 * 60 * 60 * 1000;

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

function setupEligible({
  nectar = 6,
  perm = 'undetermined',
}: { nectar?: number; perm?: 'granted' | 'denied' | 'undetermined' } = {}) {
  // Declined 4 days ago at 1 log; now `nectar` logs.
  recordNotifSoftAskDecline(1, Date.now() - 4 * DAY);
  useCalibrationStore.setState({
    loadReclaimSummary: jest.fn().mockResolvedValue(makeReclaimSummary(nectar)),
  });
  mockGetPermStatus.mockResolvedValue(perm);
}

beforeEach(() => {
  kv.clearAll();
  mockGetPermStatus.mockReset();
  mockEnsurePerm.mockReset();
  mockEnsurePerm.mockResolvedValue(true);
  useSettingsStore.setState({ remindersEnabled: false });
  useCalibrationStore.setState({
    loadReclaimSummary: jest.fn().mockResolvedValue(makeReclaimSummary(0)),
  });
});

describe('useNotifReask — show predicate', () => {
  it('shows the overrun variant for an eligible decline + overrun log, and spends the budget', async () => {
    setupEligible();
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});

    expect(result.current.show).toBe(true);
    expect(result.current.trigger).toBe('overrun');
    // One-shot budget spent the moment it renders.
    expect(getNotifReaskMeta().used).toBe(true);
  });

  it('shows the granted variant when OS permission already exists, even without overrun', async () => {
    setupEligible({ perm: 'granted' });
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 30 }));
    await act(async () => {});

    expect(result.current.show).toBe(true);
    expect(result.current.trigger).toBe('granted');
  });

  it('does NOT show when the log landed near its guess (no moment)', async () => {
    setupEligible();
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 32 }));
    await act(async () => {});
    expect(result.current.show).toBe(false);
    expect(getNotifReaskMeta().used).toBe(false);
  });

  it('does NOT show when the budget is already spent', async () => {
    setupEligible();
    const first = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});
    expect(first.result.current.show).toBe(true);
    first.unmount();

    const second = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});
    expect(second.result.current.show).toBe(false);
  });

  it('does NOT show when the soft-ask was never declined', async () => {
    useCalibrationStore.setState({
      loadReclaimSummary: jest.fn().mockResolvedValue(makeReclaimSummary(6)),
    });
    mockGetPermStatus.mockResolvedValue('undetermined');
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});
    expect(result.current.show).toBe(false);
  });

  // Legacy decline (before re-ask existed): stamps are backfilled with "now" so
  // the clocks start fresh — the row must NOT appear on this first check.
  it('backfills stamps for a legacy decline and stays hidden until clocks run', async () => {
    setNotifSoftAsk('declined'); // no meta
    useCalibrationStore.setState({
      loadReclaimSummary: jest.fn().mockResolvedValue(makeReclaimSummary(9)),
    });
    mockGetPermStatus.mockResolvedValue('undetermined');

    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});

    expect(result.current.show).toBe(false);
    const meta = getNotifReaskMeta();
    expect(meta.declinedAtMs).not.toBeNull();
    expect(meta.nectarAtDecline).toBe(9);
  });
});

describe('useNotifReask — accept paths', () => {
  it('granted variant: accept flips Reminders ON without firing the OS prompt', async () => {
    setupEligible({ perm: 'granted' });
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 30 }));
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(useSettingsStore.getState().remindersEnabled).toBe(true);
    expect(mockEnsurePerm).not.toHaveBeenCalled();
    expect(result.current.show).toBe(false);
  });

  it('overrun variant: accept fires the OS prompt, flips Reminders ON when granted', async () => {
    setupEligible();
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(mockEnsurePerm).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().remindersEnabled).toBe(true);
  });

  it('overrun variant: Reminders stays OFF when the OS prompt is denied', async () => {
    setupEligible();
    mockEnsurePerm.mockResolvedValue(false);
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});

    await act(async () => { await result.current.onAccept(); });

    expect(useSettingsStore.getState().remindersEnabled).toBe(false);
  });

  it('dismiss hides the row; budget stays spent', async () => {
    setupEligible();
    const { result } = renderHook(() => useNotifReask({ guessMin: 30, actualMin: 60 }));
    await act(async () => {});

    act(() => { result.current.onDismiss(); });

    expect(result.current.show).toBe(false);
    expect(getNotifReaskMeta().used).toBe(true);
  });
});
