import { renderHook, act } from '@testing-library/react-native';
import { kv } from '@/src/lib/kv';
import {
  PAYWALL_VARIANT_KEY,
  getPaywallVariant,
  setPaywallVariant,
  usePaywallVariant,
} from '../usePaywallVariant';

describe('paywall feature variant', () => {
  beforeEach(() => kv.delete(PAYWALL_VARIANT_KEY));

  it("defaults to 'day' when nothing is stored", () => {
    expect(getPaywallVariant()).toBe('day');
  });

  it('persists a chosen variant', () => {
    setPaywallVariant('groups');
    expect(getPaywallVariant()).toBe('groups');
    setPaywallVariant('day');
    expect(getPaywallVariant()).toBe('day');
  });

  it("falls back to 'day' on an unknown stored value", () => {
    kv.set(PAYWALL_VARIANT_KEY, 'nonsense');
    expect(getPaywallVariant()).toBe('day');
  });

  it('hook reads the stored value and updates on toggle', () => {
    setPaywallVariant('groups');
    const { result } = renderHook(() => usePaywallVariant());
    expect(result.current.variant).toBe('groups');
    act(() => result.current.setVariant('day'));
    expect(result.current.variant).toBe('day');
    expect(getPaywallVariant()).toBe('day');
  });
});
