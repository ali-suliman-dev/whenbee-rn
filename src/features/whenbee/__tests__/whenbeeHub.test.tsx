import { render, screen } from '@testing-library/react-native';
import { WhenbeeHub } from '@/src/features/whenbee/WhenbeeHub';
import { useWhenbeeHub, type WhenbeeHubVM } from '@/src/features/whenbee/useWhenbeeHub';

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

function vm(overrides: Partial<WhenbeeHubVM> = {}): WhenbeeHubVM {
  return {
    reclaimLifetimeMin: 0,
    reclaimByCategory: [],
    biggestArea: null,
    honestLogCount: 0,
    blindSpot: null,
    tier: 'Raw',
    cells: [],
    refresh: jest.fn(),
    ...overrides,
  };
}

describe('WhenbeeHub', () => {
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

  it('renders the day-honest CTA', () => {
    mockHook.mockReturnValue(vm());

    render(<WhenbeeHub />);

    expect(screen.getByText('Make my whole day honest')).toBeOnTheScreen();
  });
});
