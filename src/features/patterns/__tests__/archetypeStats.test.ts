import { archetypeStats } from '@/src/features/patterns/archetypeStats';
import type { CalibrationMapRow } from '@/src/features/patterns/usePatterns';

function row(over: Partial<CalibrationMapRow>): CalibrationMapRow {
  return {
    categoryId: 'c',
    categoryName: 'Cat',
    guessMin: 15,
    honestMin: 20,
    multiplier: 1.3,
    sampleSize: 5,
    confidence: 'honest',
    ...over,
  };
}

describe('archetypeStats', () => {
  it('returns nothing with no calibrated categories', () => {
    expect(archetypeStats([])).toEqual([]);
  });

  it('sums the tracked-task count across categories (singular at 1)', () => {
    expect(archetypeStats([row({ sampleSize: 1 })])[0]).toEqual({ label: 'Tracked', value: '1 task' });
    expect(
      archetypeStats([row({ categoryId: 'a', sampleSize: 4 }), row({ categoryId: 'b', sampleSize: 8 })])[0],
    ).toEqual({ label: 'Tracked', value: '12 tasks' });
  });

  it('names the most-accurate (closest to 1×) and longest-running category', () => {
    const rows = archetypeStats([
      row({ categoryId: 'email', categoryName: 'Email', multiplier: 1.05 }),
      row({ categoryId: 'reports', categoryName: 'Reports', multiplier: 1.9 }),
    ]);
    expect(rows).toContainEqual({ label: 'Most accurate', value: 'Email' });
    expect(rows).toContainEqual({ label: 'Runs longest', value: 'Reports' });
  });

  it('skips "Runs longest" when only one category exists', () => {
    const rows = archetypeStats([row({ categoryName: 'Email' })]);
    expect(rows.some((r) => r.label === 'Runs longest')).toBe(false);
    expect(rows).toContainEqual({ label: 'Most accurate', value: 'Email' });
  });
});
