import { act } from '@testing-library/react-native';
import { useFeedbackStore, computeHasUnread } from '../feedbackStore';
import type { ChangelogEntry } from '@/src/features/feedback/types';

const mockFetchChangelog = jest.fn();
const mockSubmitFeedback = jest.fn();
const mockDrainQueue = jest.fn().mockResolvedValue(undefined);

jest.mock('@/src/services/feedback', () => ({
  fetchChangelog: (...a: unknown[]) => mockFetchChangelog(...a),
  submitFeedback: (...a: unknown[]) => mockSubmitFeedback(...a),
  drainQueue: (...a: unknown[]) => mockDrainQueue(...a),
}));

const entries: ChangelogEntry[] = [
  { id: '1', status: 'shipped', title: 'Fast timer', body: 'Faster now.', publishedAt: '2026-07-14T00:00:00Z' },
  { id: '2', status: 'planned', title: 'Widgets', body: 'Coming soon.', publishedAt: '2026-07-02T00:00:00Z' },
];

describe('feedbackStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchChangelog.mockResolvedValue(entries);
    mockDrainQueue.mockResolvedValue(undefined);
    useFeedbackStore.setState({ changelog: [], loading: false, lastSeenAt: null });
  });

  it('loadChangelog populates the shared changelog', async () => {
    await act(async () => {
      await useFeedbackStore.getState().loadChangelog();
    });
    expect(useFeedbackStore.getState().changelog).toEqual(entries);
    expect(useFeedbackStore.getState().loading).toBe(false);
  });

  it('hasUnread is true once loaded with an unseen entry', async () => {
    await act(async () => {
      await useFeedbackStore.getState().loadChangelog();
    });
    const state = useFeedbackStore.getState();
    expect(computeHasUnread(state.changelog, state.lastSeenAt)).toBe(true);
  });

  it('markChangelogSeen advances lastSeenAt and flips hasUnread to false', async () => {
    await act(async () => {
      await useFeedbackStore.getState().loadChangelog();
    });
    act(() => {
      useFeedbackStore.getState().markChangelogSeen();
    });
    const state = useFeedbackStore.getState();
    expect(state.lastSeenAt).toBe('2026-07-14T00:00:00Z');
    expect(computeHasUnread(state.changelog, state.lastSeenAt)).toBe(false);
  });
});
