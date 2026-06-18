import { render, screen, waitFor } from '@testing-library/react-native';

// Control the reclaim summary the endowment reads.
const mockLoad = jest.fn();
jest.mock('@/src/stores/calibrationStore', () => ({
  useCalibrationStore: (selector: (s: unknown) => unknown) =>
    selector({ loadReclaimSummary: mockLoad }),
}));

/* eslint-disable import/first */
import { ReclaimEndowment } from '../ReclaimEndowment';
/* eslint-enable import/first */

beforeEach(() => jest.clearAllMocks());

describe('ReclaimEndowment', () => {
  it('shows the earned total and provenance once a positive summary loads', async () => {
    mockLoad.mockResolvedValue({ lifetimeMin: 860, honestLogCount: 38, byCategory: [], biggestArea: null });
    render(<ReclaimEndowment />);

    await waitFor(() => expect(screen.getByText('14h 20m')).toBeTruthy());
    expect(screen.getByText(/from 38 honest logs/)).toBeTruthy();
    expect(screen.getByText(/already reclaimed/i)).toBeTruthy();
  });

  it('renders nothing when the user has reclaimed zero (never fabricates a number)', async () => {
    mockLoad.mockResolvedValue({ lifetimeMin: 0, honestLogCount: 0, byCategory: [], biggestArea: null });
    render(<ReclaimEndowment />);

    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(screen.queryByText(/already reclaimed/i)).toBeNull();
  });

  it('stays hidden if the summary read fails (a paywall never crashes on data)', async () => {
    mockLoad.mockRejectedValue(new Error('db unavailable'));
    render(<ReclaimEndowment />);

    await waitFor(() => expect(mockLoad).toHaveBeenCalled());
    expect(screen.queryByText(/already reclaimed/i)).toBeNull();
  });
});
