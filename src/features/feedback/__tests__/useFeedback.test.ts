import { computeHasUnread } from '../useFeedback';
import type { ChangelogEntry } from '../types';

const e = (id: string, publishedAt: string): ChangelogEntry =>
  ({ id, status: 'shipped', title: 't', body: 'b', publishedAt });

describe('computeHasUnread', () => {
  const list = [e('1', '2026-07-14T00:00:00Z'), e('2', '2026-07-02T00:00:00Z')];
  it('true when nothing seen yet', () => {
    expect(computeHasUnread(list, null)).toBe(true);
  });
  it('true when a newer entry exists', () => {
    expect(computeHasUnread(list, '2026-07-10T00:00:00Z')).toBe(true);
  });
  it('false when all seen', () => {
    expect(computeHasUnread(list, '2026-07-14T00:00:00Z')).toBe(false);
  });
  it('false for empty list', () => {
    expect(computeHasUnread([], null)).toBe(false);
  });
});
