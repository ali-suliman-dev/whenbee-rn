import { getInstallAt, secondsSinceInstall } from '../install';
import { kv } from '../kv';

const KEY = 'whenbee.installAt';

describe('install', () => {
  beforeEach(() => kv.delete(KEY));

  it('stamps the install time on first read and returns it', () => {
    const at = getInstallAt(1000);
    expect(at).toBe(1000);
    expect(kv.getString(KEY)).toBe('1000');
  });

  it('returns the stored stamp on subsequent reads (never overwritten)', () => {
    getInstallAt(1000);
    // A later "now" must not move the install moment.
    expect(getInstallAt(9999)).toBe(1000);
  });

  it('measures whole seconds since install, never negative', () => {
    getInstallAt(1000);
    expect(secondsSinceInstall(1000 + 42_000)).toBe(42);
    // A clock that went backward clamps to 0 rather than going negative.
    expect(secondsSinceInstall(500)).toBe(0);
  });
});
