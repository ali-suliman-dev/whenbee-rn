import { buildRoutineRail } from '../routineRailModel';

// stepHonestMinutes(guess, m) = max(5, round5(guess*m)); routineHonestTotal sums then
// applies transitionFactor and round5s. With m=1, transitionFactor=1 the honest total
// equals the sum of per-step honest minutes (no in-between), so breathers are 0.
const mOne = () => 1;

describe('buildRoutineRail', () => {
  it('returns empty rows for no steps', () => {
    const m = buildRoutineRail({ steps: [], mFor: mOne, transitionFactor: 1, doneByMinuteOfDay: null });
    expect(m.rows).toEqual([]);
    expect(m.honestTotalMin).toBe(0);
    expect(m.startByMin).toBeNull();
  });

  it('builds start → step → finish for one step (no breather)', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'Get ready', category: 'getting_ready', guessMin: 20 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: null,
    });
    expect(m.rows.map((r) => r.kind)).toEqual(['start', 'step', 'finish']);
    expect(m.honestTotalMin).toBe(20);
  });

  it('inserts a breather row between consecutive steps', () => {
    const m = buildRoutineRail({
      steps: [
        { id: 'a', label: 'A', category: 'x', guessMin: 20 },
        { id: 'b', label: 'B', category: 'y', guessMin: 20 },
      ],
      mFor: mOne,
      transitionFactor: 1.5, // forces in-between minutes
      doneByMinuteOfDay: null,
    });
    expect(m.rows.map((r) => r.kind)).toEqual(['start', 'step', 'breather', 'step', 'finish']);
    const breather = m.rows.find((r) => r.kind === 'breather');
    expect(breather && breather.kind === 'breather' && breather.min).toBeGreaterThan(0);
  });

  it('clock times are null when no finish-by is set', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'A', category: 'x', guessMin: 20 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: null,
    });
    expect(m.startByMin).toBeNull();
    expect(m.rows.every((r) => (r.kind === 'step' || r.kind === 'start' || r.kind === 'finish' ? r.clockMin === null : true))).toBe(true);
  });

  it('derives start-by and cumulative clock times from finish-by', () => {
    // two 20-min steps, transitionFactor 1 → honestTotal 40, no breather.
    // finish 8:40 = 520 min. start = 520 - 40 = 480 (8:00). step A at 480, step B at 500.
    const m = buildRoutineRail({
      steps: [
        { id: 'a', label: 'A', category: 'x', guessMin: 20 },
        { id: 'b', label: 'B', category: 'y', guessMin: 20 },
      ],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: 520,
    });
    expect(m.startByMin).toBe(480);
    const [start, stepA, stepB, finish] = [m.rows[0], m.rows[1], m.rows[2], m.rows[3]];
    expect(start && start.kind === 'start' && start.clockMin).toBe(480);
    expect(stepA && stepA.kind === 'step' && stepA.clockMin).toBe(480);
    expect(stepB && stepB.kind === 'step' && stepB.clockMin).toBe(500);
    expect(finish && finish.kind === 'finish' && finish.clockMin).toBe(520);
  });

  it('advances cursor by sub-5-min breather so later step clockMin stays anchored', () => {
    // 5 steps × 20 min each, m=1 → perStep=[20,20,20,20,20], sumSteps=100
    // transitionFactor=1.05 → honestTotalMin=round5(105)=105, totalBreather=5
    // nGaps=4, breatherEach=5/4=1.25, round5(1.25)=0 → no breather rows drawn
    // BUT cursor must still advance by 1.25 min per gap.
    // doneByMinuteOfDay=600 → startByMin=495
    // step1.clockMin=495, step2.clockMin=495+20+1.25=516.25 (not 515).
    const m = buildRoutineRail({
      steps: [
        { id: 'a', label: 'A', category: 'x', guessMin: 20 },
        { id: 'b', label: 'B', category: 'x', guessMin: 20 },
        { id: 'c', label: 'C', category: 'x', guessMin: 20 },
        { id: 'd', label: 'D', category: 'x', guessMin: 20 },
        { id: 'e', label: 'E', category: 'x', guessMin: 20 },
      ],
      mFor: mOne,
      transitionFactor: 1.05,
      doneByMinuteOfDay: 600,
    });
    // No breather rows because round5(1.25) = 0.
    expect(m.rows.every((r) => r.kind !== 'breather')).toBe(true);
    expect(m.startByMin).toBe(495);
    const step1 = m.rows[1];
    const step2 = m.rows[2];
    expect(step1 && step1.kind === 'step' && step1.clockMin).toBe(495);
    // Cursor must have advanced by breatherEach=1.25 between step1 and step2.
    expect(step2 && step2.kind === 'step' && step2.clockMin).toBe(516.25);
  });

  it('start-by floors at 0 when the routine is longer than the finish-by', () => {
    const m = buildRoutineRail({
      steps: [{ id: 'a', label: 'A', category: 'x', guessMin: 30 }],
      mFor: mOne,
      transitionFactor: 1,
      doneByMinuteOfDay: 10,
    });
    expect(m.startByMin).toBe(0);
  });
});
