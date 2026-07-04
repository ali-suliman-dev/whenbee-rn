import { evaluateForgotten } from '../useForgotCheck';

const running = {
  taskLabel: 'Deep work',
  category: 'Work',
  estimateMin: 45,
  startedAt: 0,
  pausedAccumMs: 0,
  pausedAt: null,
  guessMin: 40,
  taskId: null,
  suggestedHonestMin: 50, // honest = 50; balanced close = round(50×1.5)+20 = 95
  isQuickStart: false,
  guardNudged: false,
};

describe('evaluateForgotten', () => {
  it('returns null before the close threshold', () => {
    // 90 min elapsed < 95 close threshold
    const r = evaluateForgotten({ snap: running, nowMs: 90 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });

  it('parks a pending record past the close threshold, recovering the honest finish', () => {
    const r = evaluateForgotten({ snap: running, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).not.toBeNull();
    expect(r?.category).toBe('Work');
    expect(r?.recoveredActualMin).toBe(50); // honest, not 300
    expect(r?.elapsedMin).toBe(300);
  });

  it('ignores a paused session (intentional pause, not forgotten)', () => {
    const paused = { ...running, pausedAt: 10 * 60_000 };
    const r = evaluateForgotten({ snap: paused, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });

  it('ignores a quick-start session with no category (out of P0 auto-bank)', () => {
    const quick = { ...running, category: null, isQuickStart: true };
    const r = evaluateForgotten({ snap: quick, nowMs: 300 * 60_000, stepIn: 'balanced' });
    expect(r).toBeNull();
  });
});
