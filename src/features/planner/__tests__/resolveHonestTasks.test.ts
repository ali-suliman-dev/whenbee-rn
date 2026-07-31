import { resolveHonestTasks } from '../resolveHonestTasks';

describe('resolveHonestTasks', () => {
  it('uses draft durationMin directly and resolves today guesses', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'd1', label: 'Deep work', durationMin: 90, status: 'upcoming' }],
      todayTasks: [{ id: 't1', label: 'Email', category: 'email', guessMin: 10, status: 'queued' }],
      statsByCategory: {}, // no stats → prior basis
      seed: undefined,
    });
    expect(out.tasks.find((t) => t.id === 'd1')?.honestMin).toBe(90);
    expect(out.tasks.find((t) => t.id === 't1')?.honestMin).toBeGreaterThan(0);
  });

  it('dedupes today tasks already in the draft by id', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'x', label: 'X', durationMin: 30, status: 'upcoming' }],
      todayTasks: [{ id: 'x', label: 'X', category: 'admin', guessMin: 20, status: 'queued' }],
      statsByCategory: {},
      seed: undefined,
    });
    expect(out.tasks.filter((t) => t.id === 'x').length).toBe(1);
  });

  it('flags done tasks (kept in the list with done=true)', () => {
    const out = resolveHonestTasks({
      draftTasks: [],
      todayTasks: [{ id: 'd', label: 'Done', category: 'admin', guessMin: 20, status: 'done' }],
      statsByCategory: {},
      seed: undefined,
    });
    expect(out.tasks.find((t) => t.id === 'd')?.done).toBe(true);
  });

  it('basis is prior when every task fell back to priors', () => {
    const out = resolveHonestTasks({
      draftTasks: [],
      todayTasks: [{ id: 't1', label: 'Email', category: 'email', guessMin: 10, status: 'queued' }],
      statsByCategory: {},
      seed: undefined,
    });
    expect(out.basis).toBe('prior');
  });

  it('basis is personal when a draft task is present', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'd1', label: 'Deep work', durationMin: 90, status: 'upcoming' }],
      todayTasks: [],
      statsByCategory: {},
      seed: undefined,
    });
    expect(out.basis).toBe('personal');
  });

  it('keeps draft order first, then today tasks', () => {
    const out = resolveHonestTasks({
      draftTasks: [{ id: 'd1', label: 'A', durationMin: 30, status: 'upcoming' }],
      todayTasks: [{ id: 't1', label: 'B', category: 'admin', guessMin: 20, status: 'queued' }],
      statsByCategory: {},
      seed: undefined,
    });
    expect(out.tasks.map((t) => t.id)).toEqual(['d1', 't1']);
  });
});
