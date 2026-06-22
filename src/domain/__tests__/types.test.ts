import type {
  Tier,
  AdaptSpeed,
  LogSource,
  LogStatus,
  CategoryStats,
  CalibrationSummary,
  Insight,
  TrendSeries,
  TaskEvent,
} from '../types';

// Compile-time shape locks: each assignment fails typecheck if a field changes.
describe('domain types', () => {
  it('locks the enum unions and struct shapes', () => {
    const tier: Tier = 'Ripening';
    const speed: AdaptSpeed = 'balanced';
    const source: LogSource = 'timed';
    const status: LogStatus = 'completed';
    const stats: CategoryStats = { categoryId: 'cleaning', n: 8, logEwma: 0.2, mEffective: 1.9, sharpness: 78, reclaimedMinutes: 0 };
    const summary: CalibrationSummary = {
      multiplier: 1.9, honestMinutes: 30, guessMinutes: 15, basis: 'personal', label: 'based on your last 8 times', sampleSize: 8,
    };
    const insight: Insight = { categoryId: 'cleaning', multiplier: 1.9, honestForFifteen: 29, headline: '~29m vs your 15m guess · runs 1.9×' };
    const trend: TrendSeries = { points: [{ loggedAt: 1, multiplier: 1.6 }], caption: 'stabilizing' };
    const event: TaskEvent = {
      id: 'a', category: 'cleaning', label: null, estimateMin: 15, actualMin: 30,
      status: 'completed', source: 'timed', startedAt: 1, endedAt: 2, createdAt: 3,
      suggestedHonestMin: null, reclaimDividendMin: 0, startLocalMinute: null,
    };

    expect([tier, speed, source, status]).toHaveLength(4);
    expect(stats.sharpness).toBe(78);
    expect(summary.basis).toBe('personal');
    expect(insight.honestForFifteen).toBe(29);
    expect(trend.caption).toBe('stabilizing');
    expect(event.status).toBe('completed');
  });
});
