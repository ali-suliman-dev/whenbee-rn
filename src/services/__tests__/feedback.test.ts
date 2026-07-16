import { submitFeedback, fetchChangelog } from '../feedback';

const mockInsert = jest.fn();
const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ insert: mockInsert, select: mockSelect }));
const mockGetFeedbackClient = jest.fn((): { from: typeof mockFrom } | null => ({ from: mockFrom }));

jest.mock('../feedbackClient', () => ({ getFeedbackClient: () => mockGetFeedbackClient() }));
jest.mock('@/src/features/feedback/installId', () => ({ getInstallId: () => 'install-1' }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const mockEnqueue = jest.fn();
jest.mock('@/src/features/feedback/queue', () => ({
  enqueue: (...a: unknown[]) => mockEnqueue(...a),
  readQueue: () => [],
  writeQueue: () => {},
}));

beforeEach(() => { jest.clearAllMocks(); });

describe('submitFeedback', () => {
  it('inserts the full payload on success', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await submitFeedback({ kind: 'idea', category: 'Timer', body: 'hello' });
    expect(mockFrom).toHaveBeenCalledWith('feedback_submissions');
    expect(mockInsert).toHaveBeenCalledWith({
      kind: 'idea', category: 'Timer', body: 'hello',
      install_id: 'install-1', app_version: '1.2.3', os: 'ios', locale: 'en-US',
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('enqueues after repeated failure and never throws', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'boom' } });
    await expect(submitFeedback({ kind: 'love', body: 'x' })).resolves.toBeUndefined();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it('returns early without inserting or enqueuing when there is no client', async () => {
    mockGetFeedbackClient.mockReturnValueOnce(null);
    await expect(submitFeedback({ kind: 'idea', body: 'no backend' })).resolves.toBeUndefined();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

describe('fetchChangelog', () => {
  it('maps published rows to ChangelogEntry', async () => {
    mockOrder.mockResolvedValue({ data: [
      { id: '1', status: 'shipped', title: 'T', body: 'B', published_at: '2026-07-14T00:00:00Z' },
    ], error: null });
    const rows = await fetchChangelog();
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('is_published', true);
    expect(rows).toEqual([
      { id: '1', status: 'shipped', title: 'T', body: 'B', publishedAt: '2026-07-14T00:00:00Z' },
    ]);
  });

  it('returns [] on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'nope' } });
    expect(await fetchChangelog()).toEqual([]);
  });

  it('drops a row with a null published_at', async () => {
    mockOrder.mockResolvedValue({ data: [
      { id: '1', status: 'shipped', title: 'T', body: 'B', published_at: null },
      { id: '2', status: 'planned', title: 'U', body: 'C', published_at: '2026-07-14T00:00:00Z' },
    ], error: null });
    const rows = await fetchChangelog();
    expect(rows).toEqual([
      { id: '2', status: 'planned', title: 'U', body: 'C', publishedAt: '2026-07-14T00:00:00Z' },
    ]);
  });
});
