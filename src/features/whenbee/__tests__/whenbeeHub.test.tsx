import { render, screen } from '@testing-library/react-native';
import { WhenbeeHub } from '@/src/features/whenbee/WhenbeeHub';
import { useWhenbeeHub, type WhenbeeHubVM } from '@/src/features/whenbee/useWhenbeeHub';
import { capabilityFor } from '@/src/engine';
import type { CompanionPresence } from '@/src/stores/calibrationStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

// Mock expo-router: router.push is a spy; useFocusEffect runs the callback once
// (mirrors an immediate focus) so the on-focus refresh path is exercised.
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => cb(),
}));

// Feed the hub VM fixtures directly — no DB stand-up in the screen test.
jest.mock('@/src/features/whenbee/useWhenbeeHub', () => ({
  __esModule: true,
  useWhenbeeHub: jest.fn(),
}));

const mockHook = useWhenbeeHub as jest.MockedFunction<typeof useWhenbeeHub>;

const COMPANION_FIXTURE: CompanionPresence = {
  stage: 1,
  capability: capabilityFor(1),
  keeper: false,
  lifetimeNectar: 0,
  driftHealth: 'settled',
  seed: 1,
  name: null,
};

function vm(overrides: Partial<WhenbeeHubVM> = {}): WhenbeeHubVM {
  return {
    reclaimLifetimeMin: 0,
    reclaimByCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    blindSpot: null,
    leadSharpness: 0,
    tier: 'Raw',
    companion: COMPANION_FIXTURE,
    cells: [],
    discoveries: [],
    discoveryCount: 0,
    refresh: jest.fn(),
    renameCompanion: jest.fn(),
    showDriftRecheck: false,
    dismissDriftRecheck: jest.fn(),
    ...overrides,
  };
}

describe('WhenbeeHub', () => {
  beforeEach(() => {
    // Start each test with empty stores — tests that need categories set them explicitly.
    useCategoriesStore.setState({ categories: [] });
    useCalibrationStore.setState({ statsByCategory: {} } as Parameters<typeof useCalibrationStore.setState>[0]);
    useEntitlement.setState({ isPro: false, ready: true });
  });
  afterEach(() => jest.clearAllMocks());

  it('renders the formatted reclaim number + provenance when lifetime > 0', () => {
    mockHook.mockReturnValue(
      vm({ reclaimLifetimeMin: 860, honestLogCount: 23, tier: 'Ripening' }),
    );

    render(<WhenbeeHub />);

    // 860 min → "14h 20m"
    expect(screen.getByText('14h 20m')).toBeOnTheScreen();
    expect(screen.getByText('from 23 honest logs · learned on-device')).toBeOnTheScreen();
  });

  it('renders the no-guilt empty copy and NO number when lifetime is 0', () => {
    mockHook.mockReturnValue(vm({ reclaimLifetimeMin: 0 }));

    render(<WhenbeeHub />);

    expect(
      screen.getByText('Your reclaim starts with your first honest log. No rush.'),
    ).toBeOnTheScreen();
    // No reclaim hero number is rendered in the empty state.
    expect(screen.queryByText('0m')).toBeNull();
    expect(screen.queryByText(/honest logs · learned on-device/)).toBeNull();
  });

  it('hides the blind-spot card when blindSpot is null', () => {
    mockHook.mockReturnValue(vm({ blindSpot: null }));

    render(<WhenbeeHub />);

    expect(screen.queryByText("WHENBEE'S STILL LEARNING THIS ONE")).toBeNull();
  });

  it('shows the blind-spot card with the category name when present', () => {
    mockHook.mockReturnValue(
      vm({ blindSpot: { categoryId: 'deep_work', name: 'Deep Work', sharpness: 12 } }),
    );

    render(<WhenbeeHub />);

    expect(screen.getByText("WHENBEE'S STILL LEARNING THIS ONE")).toBeOnTheScreen();
    expect(screen.getByText('Deep Work')).toBeOnTheScreen();
  });

  it('renders the ring badge tier, the labeled zones and area rows', () => {
    // Provide one category so the YOUR AREAS zone renders.
    useCategoriesStore.setState({
      categories: [{ id: 'deep_work', name: 'Deep Work', adaptSpeed: 'balanced' }],
    });
    mockHook.mockReturnValue(
      vm({ leadSharpness: 46, reclaimLifetimeMin: 120, honestLogCount: 5, tier: 'Setting' }),
    );

    render(<WhenbeeHub />);

    // RingBadge: ringCopy(46) → tier "Setting"
    expect(screen.getByText(/Setting/)).toBeTruthy();
    // Zone labels
    expect(screen.getByText('Reclaimed')).toBeTruthy();
    expect(screen.getByText('Your areas')).toBeTruthy();
  });

  it('shows the empty CTA when there are no logs', () => {
    mockHook.mockReturnValue(
      vm({ leadSharpness: 0, reclaimLifetimeMin: 0, honestLogCount: 0 }),
    );

    render(<WhenbeeHub />);

    expect(screen.getByText('Log your first task')).toBeTruthy();
  });

  it('renders the day-honest CTA when there are logs', () => {
    mockHook.mockReturnValue(vm({ honestLogCount: 5, reclaimLifetimeMin: 60 }));

    render(<WhenbeeHub />);

    expect(screen.getByText('Make my whole day honest')).toBeOnTheScreen();
  });
});
