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
  cancelTimerDone: () => mockCancel(),
}));

/* eslint-disable import/first */
import { useReminderSetting } from '../useReminderSetting';
import { useSettingsStore } from '@/src/stores/settingsStore';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsurePermission.mockImplementation(() => Promise.resolve(true));
  useSettingsStore.setState({ remindersEnabled: false });
});

describe('useReminderSetting', () => {
  it('defaults to off', () => {
    const { result } = renderHook(() => useReminderSetting());
    expect(result.current.enabled).toBe(false);
  });

  it('enables when permission is granted', async () => {
    const { result } = renderHook(() => useReminderSetting());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.toggle(true);
    });

    expect(ok).toBe(true);
    expect(useSettingsStore.getState().remindersEnabled).toBe(true);
    expect(mockCapture).toHaveBeenCalledWith('reminder_enabled', {});
  });

  it('stays off and reports false when permission is denied', async () => {
    mockEnsurePermission.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useReminderSetting());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.toggle(true);
    });

    expect(ok).toBe(false);
    expect(useSettingsStore.getState().remindersEnabled).toBe(false);
    expect(mockCapture).not.toHaveBeenCalledWith('reminder_enabled', {});
  });

  it('disabling turns it off and cancels any pending ping', async () => {
    useSettingsStore.setState({ remindersEnabled: true });
    const { result } = renderHook(() => useReminderSetting());

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(useSettingsStore.getState().remindersEnabled).toBe(false);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('reminder_disabled', {});
  });
});
