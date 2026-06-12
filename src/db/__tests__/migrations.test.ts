import { MIGRATIONS } from '../migrations';

describe('MIGRATIONS', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(MIGRATIONS)).toBe(true);
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    for (const m of MIGRATIONS) {
      expect(typeof m).toBe('string');
    }
  });

  it('every entry contains a CREATE TABLE statement', () => {
    for (const m of MIGRATIONS) {
      expect(m).toContain('CREATE TABLE');
    }
  });

  it('covers the three core tables', () => {
    const joined = MIGRATIONS.join('\n');
    expect(joined).toContain('task_events');
    expect(joined).toContain('category_stats');
    expect(joined).toContain('recurring_stats');
  });
});
