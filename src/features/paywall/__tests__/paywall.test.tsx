import { readFileSync } from 'fs';
import { join } from 'path';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Names are `mock`-prefixed so Babel allows referencing them inside the hoisted
// jest.mock factories.
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack() } }));

// analytics: assert the funnel events fire with the right props.
const mockCapture = jest.fn();
jest.mock('@/src/services/analytics', () => ({ analytics: { capture: (...a: unknown[]) => mockCapture(...a) } }));

// purchases service: feed a controllable offering into useOfferings.
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

// calibration store: stub loadReclaimSummary so the paywall never touches the db,
// even though no current paywall surface reads it.
const mockLoadReclaimSummary = () =>
  Promise.resolve({ lifetimeMin: 0, byCategory: [], biggestArea: null, honestLogCount: 0 });
jest.mock('@/src/stores/calibrationStore', () => ({
  useCalibrationStore: (selector: (s: unknown) => unknown) =>
    selector({ loadReclaimSummary: mockLoadReclaimSummary }),
}));

// founder reserve: stub the kv hook so the paywall doesn't touch real storage.
const mockReserve = jest.fn();
const mockReservedRef = { reserved: false };
jest.mock('../useFounderReserve', () => ({
  useFounderReserve: () => ({ reserved: mockReservedRef.reserved, reserve: mockReserve }),
}));

// Imports follow the jest.mock() factories above so the mocks register first.
/* eslint-disable import/first */
import { Paywall } from '../Paywall';
import type { Offering, Package } from '@/src/services/purchases';
/* eslint-enable import/first */

const YEARLY: Package = { id: 'rc_annual', duration: 'yearly', priceString: 'PRICE_YEARLY_42', productId: 'wb_pro_yearly' };
const LIFETIME: Package = { id: 'rc_lifetime', duration: 'lifetime', priceString: 'PRICE_LIFETIME_99', productId: 'wb_pro_lifetime' };
const MONTHLY: Package = { id: 'rc_monthly', duration: 'monthly', priceString: 'PRICE_MONTHLY_05', productId: 'wb_pro_monthly' };

const FOUNDER: Package = { id: 'rc_founder', duration: 'lifetime', priceString: 'PRICE_FOUNDER_49', productId: 'wb_pro_founder' };

const OFFERING: Offering = { id: 'default', packages: [MONTHLY, YEARLY, LIFETIME] };
const OFFERING_WITH_FOUNDER: Offering = { id: 'default', packages: [MONTHLY, YEARLY, LIFETIME, FOUNDER] };

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
});

describe('Paywall', () => {
  it('renders the store priceStrings from the offering (never hardcoded)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);

    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());
    expect(screen.getByText('PRICE_LIFETIME_99')).toBeTruthy();
    expect(screen.getByText('PRICE_MONTHLY_05')).toBeTruthy();
  });

  it('does not hardcode any price literal in the paywall source', () => {
    const dir = join(__dirname, '..');
    const sources = ['Paywall.tsx', 'PlanPicker.tsx', 'useOfferings.ts']
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    // The locked reference prices must never appear as literals — they come from
    // the store package's priceString.
    expect(sources).not.toMatch(/\$4\.99/);
    expect(sources).not.toMatch(/\$34\.99/);
    expect(sources).not.toMatch(/\$89/);
  });

  it('fires paywall_view once on mount with the trigger', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    const views = mockCapture.mock.calls.filter((c) => c[0] === 'paywall_view');
    expect(views).toHaveLength(1);
    expect(views[0][1]).toEqual({ trigger: 'settings_upgrade', readiness: 'pre' });
  });

  it('tapping a plan selects it and reports plan_selected', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText('PRICE_LIFETIME_99')).toBeTruthy());

    fireEvent.press(screen.getByText('PRICE_LIFETIME_99'));

    const selected = mockCapture.mock.calls.filter((c) => c[0] === 'plan_selected');
    expect(selected.at(-1)?.[1]).toEqual({ plan: 'lifetime' });
    // Lifetime CTA switches to the one-time unlock label, carrying the store price.
    expect(screen.getByText(/Unlock Pro — PRICE_LIFETIME_99/)).toBeTruthy();
  });

  it('tapping the CTA calls purchase with the selected package', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);
    // Yearly is the default selection — CTA is the trial verb.
    await waitFor(() => expect(screen.getByText('Try 7 days free')).toBeTruthy());

    mockProRef.isPro = true; // purchase resolves to Pro
    await act(async () => {
      fireEvent.press(screen.getByText('Try 7 days free'));
    });

    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect(mockPurchase).toHaveBeenCalledWith(YEARLY);
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders a loading state without crashing', () => {
    const d = deferred<Offering | null>();
    mockGetOfferings.mockReturnValue(d.promise);
    render(<Paywall trigger="settings_upgrade" />);
    expect(screen.getByText('Loading plans…')).toBeTruthy();
  });

  it('renders a graceful unavailable state when the offering is empty', async () => {
    mockGetOfferings.mockResolvedValue({ id: 'default', packages: [] });
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText(/Plans are not available right now/)).toBeTruthy());
  });

  it('renders a graceful unavailable state when offerings fail', async () => {
    mockGetOfferings.mockRejectedValue(new Error('network down'));
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText(/Plans are not available right now/)).toBeTruthy());
  });

  // ── Readiness headline (Step 13) ──────────────────────────────────────────────
  it('shows the default heading when readiness is pre (or omitted)', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    expect(screen.getByText('See what your real numbers add up to.')).toBeTruthy();
    expect(screen.queryByText('Your numbers are real now.')).toBeNull();
  });

  it('shows the earned heading when readiness is honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" readiness="honest" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    expect(screen.getByText('Your numbers are real now.')).toBeTruthy();
    expect(screen.queryByText('See what your real numbers add up to.')).toBeNull();
  });

  it('passes readiness through to the paywall_view event', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" readiness="honest" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    const views = mockCapture.mock.calls.filter((c) => c[0] === 'paywall_view');
    expect(views).toHaveLength(1);
    expect(views[0][1]).toEqual({ trigger: 'settings_upgrade', readiness: 'honest' });
  });

  // ── Founder reservation card (Steps 15–16) ────────────────────────────────────
  it('renders the founder reserve card with the offering price when a founder package exists and not honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="settings_upgrade" readiness="pre" />);

    await waitFor(() => expect(screen.getByText('Lock the founder price — PRICE_FOUNDER_49')).toBeTruthy());
    expect(screen.getByText('Lock founder price')).toBeTruthy();
  });

  it('fires founder_reserve via the hook when the lock button is tapped', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="settings_upgrade" readiness="pre" />);
    await waitFor(() => expect(screen.getByText('Lock founder price')).toBeTruthy());

    fireEvent.press(screen.getByText('Lock founder price'));
    expect(mockReserve).toHaveBeenCalledTimes(1);
  });

  it('shows the locked-in state once reserved', async () => {
    mockReservedRef.reserved = true;
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="settings_upgrade" readiness="pre" />);

    await waitFor(() => expect(screen.getByText('Founder price locked in')).toBeTruthy());
  });

  it('suppresses the founder reserve card once numbers are honest', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING_WITH_FOUNDER);
    render(<Paywall trigger="settings_upgrade" readiness="honest" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    expect(screen.queryByText(/Lock the founder price/)).toBeNull();
  });

  it('does not render the founder reserve card when no founder package is present', async () => {
    mockGetOfferings.mockResolvedValue(OFFERING);
    render(<Paywall trigger="settings_upgrade" readiness="pre" />);
    await waitFor(() => expect(screen.getByText('PRICE_YEARLY_42')).toBeTruthy());

    expect(screen.queryByText(/Lock the founder price/)).toBeNull();
    expect(screen.queryByText('Lock founder price')).toBeNull();
  });
});
