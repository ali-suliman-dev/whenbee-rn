import { kv } from '@/src/lib/kv';
import { LANDING_COLLAPSE_KEY, readLandingCollapsed, writeLandingCollapsed } from '@/src/features/today/landingCollapse';

describe('landingCollapse', () => {
  beforeEach(() => kv.delete(LANDING_COLLAPSE_KEY));

  it('defaults to expanded on a fresh install', () => {
    expect(readLandingCollapsed()).toBe(false);
  });

  it('round-trips a collapsed choice', () => {
    writeLandingCollapsed(true);
    expect(readLandingCollapsed()).toBe(true);
  });

  it('round-trips back to expanded', () => {
    writeLandingCollapsed(true);
    writeLandingCollapsed(false);
    expect(readLandingCollapsed()).toBe(false);
  });

  it('treats a corrupt stored value as expanded', () => {
    kv.set(LANDING_COLLAPSE_KEY, 'not-a-bool');
    expect(readLandingCollapsed()).toBe(false);
  });
});
