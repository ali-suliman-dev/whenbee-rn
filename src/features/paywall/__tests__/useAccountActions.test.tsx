import { renderHook, act } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({
  analytics: { capture: (...a: unknown[]) => mockCapture(...a) },
}));

const mockOpenManage = jest.fn();
jest.mock('../manageSubscription', () => ({
  openManageSubscriptions: () => mockOpenManage(),
}));

// entitlement store: control restore() outcome and the post-restore isPro read.
const mockRestore = jest.fn(() => Promise.resolve());
const mockProRef = { isPro: false };
const useEntitlementMock = (selector: (s: unknown) => unknown) =>
  selector({ restore: mockRestore, isPro: mockProRef.isPro });
useEntitlementMock.getState = () => ({ isPro: mockProRef.isPro });
jest.mock('../useEntitlement', () => ({ useEntitlement: useEntitlementMock }));

/* eslint-disable import/first */
import { useAccountActions } from '../useAccountActions';
/* eslint-enable import/first */

beforeEach(() => {
  jest.clearAllMocks();
  mockProRef.isPro = false;
  mockRestore.mockImplementation(() => Promise.resolve());
});

describe('useAccountActions', () => {
  it('opens the manage-subscriptions sheet and logs the source', () => {
    const { result } = renderHook(() => useAccountActions());
    act(() => result.current.manageSubscription());

    expect(mockOpenManage).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('manage_subscription', { source: 'settings' });
  });

  it('returns "success" when restore unlocks Pro', async () => {
    mockProRef.isPro = true;
    const { result } = renderHook(() => useAccountActions());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.restorePurchases();
    });

    expect(outcome).toBe('success');
    expect(mockCapture).toHaveBeenCalledWith('restore_purchases', { result: 'success' });
  });

  it('returns "none" when no purchase is found', async () => {
    const { result } = renderHook(() => useAccountActions());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.restorePurchases();
    });

    expect(outcome).toBe('none');
    expect(mockCapture).toHaveBeenCalledWith('restore_purchases', { result: 'none' });
  });

  it('returns "error" and never throws when the store is unreachable', async () => {
    mockRestore.mockImplementation(() => Promise.reject(new Error('network')));
    const { result } = renderHook(() => useAccountActions());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.restorePurchases();
    });

    expect(outcome).toBe('error');
    expect(mockCapture).toHaveBeenCalledWith('restore_purchases', { result: 'error' });
  });
});
