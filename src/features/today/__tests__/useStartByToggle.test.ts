import { renderHook, act } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

const mockEnsurePermission = jest.fn(() => Promise.resolve(true));
const mockCancel = jest.fn(() => Promise.resolve());
jest.mock('@/src/services/timerNotifications', () => ({
  ensureNotificationPermission: () => mockEnsurePermission(),
  cancelStartBy: () => mockCancel(),
}));

/* eslint-disable import/first */
import { useStartByToggle } from '../useStartByToggle';
import { useSettingsStore } from '@/src/stores/settingsStore';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsurePermission.mockImplementation(() => Promise.resolve(true));
  useSettingsStore.setState({ startByEnabled: false });
});

describe('useStartByToggle', () => {
  it('enables only when permission is granted', async () => {
    (mockEnsurePermission as jest.Mock).mockResolvedValue(true);
    const { result } = renderHook(() => useStartByToggle());
    await act(async () => {
      expect(await result.current.toggle(true)).toBe(true);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(true);
    expect(mockCapture).toHaveBeenCalledWith('startby_reminder_enabled', {});
  });

  it('stays off when permission is denied', async () => {
    mockEnsurePermission.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useStartByToggle());
    await act(async () => {
      expect(await result.current.toggle(true)).toBe(false);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
    expect(mockCapture).not.toHaveBeenCalledWith('startby_reminder_enabled', {});
  });

  it('disabling cancels the scheduled nudge', async () => {
    useSettingsStore.setState({ startByEnabled: true });
    const { result } = renderHook(() => useStartByToggle());
    await act(async () => {
      await result.current.toggle(false);
    });
    expect(useSettingsStore.getState().startByEnabled).toBe(false);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('startby_reminder_disabled', {});
  });
});
