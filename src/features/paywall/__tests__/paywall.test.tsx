import { readFileSync } from 'fs';
import { join } from 'path';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Names are `mock`-prefixed so Babel allows referencing them inside the hoisted
// jest.mock factories.
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), replace: (...a: unknown[]) => mockReplace(...a) },
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => {},
  }),
}));

// analytics: assert the funnel events fire with the right props.
const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: (...a: unknown[]) => mockCapture(...a) } }));

// purchases service: feed a controllable offering into useOfferings. The error
// classifier lives in its own pure module (purchaseErrors) and stays REAL.
const mockGetOfferings = jest.fn();
jest.mock('@/src/services/purchases', () => ({
  getPurchases: () => ({ getOfferings: mockGetOfferings }),
}));

// entitlement store: spy on purchase/restore; expose getState().isPro.
const mockPurchase = jest.fn(() => Promise.resolve());
const mockRestore = jest.fn(() => Promise.resolve());
const mockProRef = { isPro: false };
const useEntitlementMock = (selector: (s: unknown) => unknown) =>
  selector({ purchase: mockPurchase, restore: mockRestore, isPro: mockProRef.isPro });
useEntitlementMock.getState = () => ({ isPro: mockProRef.isPro });
jest.mock('../useEntitlement', () => ({ useEntitlement: useEntitlementMock }));

// founder reserve: stub the kv hook so the paywall doesn't touch real storage.
const mockReserve = jest.fn();
const mockReservedRef = { reserved: false };
jest.mock('../useFounderReserve', () => ({
  useFounderReserve: () => ({ reserved: mockReservedRef.reserved, reserve: mockReserve }),
}));

// Imports follow the jest.mock() factories above so the mocks register first.
/* eslint-disable import/first */
import { Paywall } from '../Paywall';
import { setPaywallVariant } from '../usePaywallVariant';
import type { Offering, Package } from '@/src/services/purchases';
/* eslint-enable import/first */

const YEARLY: Package = { id: 'rc_annual', duration: 'yearly', priceString: 'PRICE_YEARLY_42', productId: 'wb_pro_yearly' };
const LIFETIME: Package = { id: 'rc_lifetime', duration: 'lifetime', priceString: 'PRICE_LIFETIME_99', productId: 'wb_pro_lifetime' };
const MONTHLY: Package = { id: 'rc_monthly', duration: 'monthly', priceString: 'PRICE_MONTHLY_05', productId: 'wb_pro_monthly' };

const FOUNDER: Package = { id: 'rc_founder', duration: 'lifetime', priceString: 'PRICE_FOUNDER_49', productId: 'wb_pro_founder' };

const OFFERING: Offering = { id: 'default', packages: [MONTHLY, YEARLY, LIFETIME] };
const OFFERING_WITH_FOUNDER: Offering = { id: 'default', packages: [MONTHLY, YEARLY, FOUNDER] };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProRef.isPro = false;
  mockReservedRef.reserved = false;
  setPaywallVariant('day');
});

describe('Paywall', () => {
  it('renders the store priceStrings from the offering (never hardcoded)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);

    // Yearly's priceString lives in its plan note ("…then PRICE_YEARLY_42 a year").
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());
    expect(screen.getByText('PRICE_LIFETIME_99')).toBeTruthy();
    expect(screen.getByText('PRICE_MONTHLY_05')).toBeTruthy();
  });

  it('does not hardcode any price literal in the paywall source', () => {
    const dir = join(__dirname, '..');
    const sources = ['Paywall.tsx', 'PlanPicker.tsx', 'DayWithPro.tsx', 'FeatureGroups.tsx', 'PaywallFooter.tsx', 'useOfferings.ts']
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    expect(sources).not.toMatch(/\$4\.99/);
    expect(sources).not.toMatch(/\$34\.99/);
    expect(sources).not.toMatch(/\$89/);
    expect(sources).not.toMatch(/\$2\.92/);
  });

  it('fires paywall_view once on mount with trigger, readiness and feature variant', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    const views = mockCapture.mock.calls.filter((c) => c[0] === 'paywall_view');
    expect(views).toHaveLength(1);
    expect(views[0][1]).toEqual({ trigger: 'settings_upgrade', readiness: 'pre', feature_variant: 'day' });
  });

  it("renders the 'groups' feature section when the variant is switched", async () => {
    setPaywallVariant('groups');
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('Plan honestly')).toBeTruthy();
    expect(screen.getByText('Hyperfocus guard')).toBeTruthy();
    expect(screen.queryByText('The morning starts honest')).toBeNull();
  });

  it("renders the 'day' feature section by default with all five moments", async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('The morning starts honest')).toBeTruthy();
    expect(screen.getByText('The week, understood')).toBeTruthy();
    expect(screen.getByText('What steals your time')).toBeTruthy();
  });

  it('tapping a plan selects it and reports plan_selected; lifetime CTA relabels', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('PRICE_LIFETIME_99')).toBeTruthy());

    fireEvent.press(screen.getByText('PRICE_LIFETIME_99'));

    const selected = mockCapture.mock.calls.filter((c) => c[0] === 'plan_selected');
    expect(selected.at(-1)?.[1]).toEqual({ plan: 'lifetime' });
    expect(screen.getByText(/Get Pro forever · PRICE_LIFETIME_99/)).toBeTruthy();
  });

  it('successful purchase routes to the pro-welcome screen (never just dismisses)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Try 7 days free')).toBeTruthy());

    mockProRef.isPro = true;
    await act(async () => {
      fireEvent.press(screen.getByText('Try 7 days free'));
    });

    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith(YEARLY);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/pro-welcome',
      params: { plan: 'yearly', purchasedAt: expect.any(String) },
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('a user-cancelled purchase shows NOTHING (no error band, no retry label)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Try 7 days free')).toBeTruthy());

    mockPurchase.mockRejectedValueOnce({ userCancelled: true });
    await act(async () => {
      fireEvent.press(screen.getByText('Try 7 days free'));
    });

    expect(screen.queryByText(/didn't go through/)).toBeNull();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.getByText('Try 7 days free')).toBeTruthy();
    const purchases = mockCapture.mock.calls.filter((c) => c[0] === 'purchase');
    expect(purchases.at(-1)?.[1]).toMatchObject({ result: 'cancelled' });
  });

  it('a failed purchase shows the inline band and the CTA becomes the retry', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Try 7 days free')).toBeTruthy());

    mockPurchase.mockRejectedValueOnce(new Error('network down'));
    await act(async () => {
      fireEvent.press(screen.getByText('Try 7 days free'));
    });

    expect(screen.getByText(/didn't go through/)).toBeTruthy();
    expect(screen.getByText(/weren't charged/)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a declined payment gets the actionable store-settings copy', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Try 7 days free')).toBeTruthy());

    mockPurchase.mockRejectedValueOnce({ code: 3 });
    await act(async () => {
      fireEvent.press(screen.getByText('Try 7 days free'));
    });

    expect(screen.getByText(/payment method was declined/)).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('restore with nothing found shows a neutral note, never an error tone', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Restore Purchases')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByText('Restore Purchases'));
    });

    expect(screen.getByText(/No earlier purchase on this account/)).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
  });

  it('successful restore routes to pro-welcome', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText('Restore Purchases')).toBeTruthy());

    mockProRef.isPro = true;
    await act(async () => {
      fireEvent.press(screen.getByText('Restore Purchases'));
    });

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/pro-welcome',
      params: { plan: 'restore', purchasedAt: expect.any(String) },
    });
  });

  it('shows the single footer link row and never a Manage-subscription link', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('Restore Purchases')).toBeTruthy();
    expect(screen.getByText('Terms')).toBeTruthy();
    expect(screen.getByText('Privacy')).toBeTruthy();
    expect(screen.queryByText(/Manage subscription/)).toBeNull();
  });

  it('shows the reminder-promise trial timeline for subscription selections', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('We remind you')).toBeTruthy();
    expect(screen.getByText(/Cancel before and you pay nothing/)).toBeTruthy();
  });

  it('renders a loading state without crashing', () => {
    const d = deferred<Offering | null>();
    mockGetOfferings.mockReturnValue(d.promise);
    render(<Paywall trigger="make_day_honest" />);
    expect(screen.getByText('Loading plans…')).toBeTruthy();
  });

  it('renders a graceful unavailable state when the offering is empty', async () => {
    mockGetOfferings.mockResolvedValue({ id: 'default', packages: [] });
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/Plans are not available right now/)).toBeTruthy());
  });

  it('renders a graceful unavailable state when offerings fail', async () => {
    mockGetOfferings.mockRejectedValue(new Error('network down'));
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/Plans are not available right now/)).toBeTruthy());
  });

  // ── Readiness headline ───────────────────────────────────────────────────────
  it('shows the trigger-specific pre heading when readiness is pre (or omitted)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('Your real day, before you live it.')).toBeTruthy();
    expect(screen.queryByText('Your numbers are real now.')).toBeNull();
  });

  it('shows the earned heading when readiness is honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" readiness="honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.getByText('Your numbers are real now.')).toBeTruthy();
    expect(screen.queryByText('Your real day, before you live it.')).toBeNull();
  });

  // ── Founder reservation card ─────────────────────────────────────────────────
  it('renders the founder reserve card with the offering price when a founder package exists and not honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="make_day_honest" readiness="pre" />);

    await waitFor(() => expect(screen.getByText('Lock the founder price — PRICE_FOUNDER_49')).toBeTruthy());
    expect(screen.getByText('Lock founder price')).toBeTruthy();
  });

  it('suppresses the founder reserve card once numbers are honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="make_day_honest" readiness="honest" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.queryByText(/Lock the founder price/)).toBeNull();
  });

  it('does not render the founder reserve card when no founder package is present', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="make_day_honest" readiness="pre" />);
    await waitFor(() => expect(screen.getByText(/PRICE_YEARLY_42/)).toBeTruthy());

    expect(screen.queryByText(/Lock the founder price/)).toBeNull();
    expect(screen.queryByText('Lock founder price')).toBeNull();
  });
});
