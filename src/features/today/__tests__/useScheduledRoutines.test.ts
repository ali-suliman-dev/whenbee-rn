// TDD: tests for useScheduledRoutines
// Verify: scheduled routine → block with correct honestTotalMin + startByMin
// Verify: routine NOT scheduled for the selected weekday → no block
// Verify: unscheduled (empty scheduleDays) → no block

import { renderHook } from '@testing-library/react-native';
import { useScheduledRoutines } from '../useScheduledRoutines';
import { useRoutinesStore } from '@/src/stores/routinesStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import type { RoutineWithSteps } from '@/src/db';
import type { ArchetypeSeed } from '@/src/domain/types';

// ── Mock stores ──────────────────────────────────────────────────────────────

jest.mock('@/src/stores/routinesStore', () => ({
  useRoutinesStore: jest.fn(),
  routineStepKey: (routineId: string, stepId: string) => `routine:${routineId}:${stepId}`,
}));

jest.mock('@/src/stores/calibrationStore', () => ({
  useCalibrationStore: jest.fn(),
}));

jest.mock('@/src/stores/settingsStore', () => ({
  useSettingsStore: jest.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a RoutineWithSteps fixture.
 * scheduleDays: weekday indices on which the routine runs (0=Sun … 6=Sat).
 * doneByMinuteOfDay: minute-of-day the user wants to be done by (e.g. 480 = 8:00).
 */
function makeRoutine(opts: {
  id: string;
  name: string;
  scheduleDays: number[];
  doneByMinuteOfDay: number | null;
  steps: { id: string; category: string; guessMin: number }[];
}): RoutineWithSteps {
  return {
    routine: {
      id: opts.id,
      name: opts.name,
      scheduleDays: opts.scheduleDays,
      doneByMinuteOfDay: opts.doneByMinuteOfDay,
      alertEnabled: false,
      alertLeadMin: 0,
      transitionFactor: 1.0,
      runCount: 0,
      createdAt: 0,
      updatedAt: 0,
    },
    steps: opts.steps.map((s, i) => ({
      id: s.id,
      routineId: opts.id,
      position: i,
      label: `Step ${i + 1}`,
      category: s.category,
      guessMin: s.guessMin,
    })),
  };
}

/**
 * Wire useRoutinesStore + useCalibrationStore mocks with the given state.
 * stepMByKey: a pre-computed map of `routine:{routineId}:{stepId}` → learned M
 * (empty means all steps fall back to category M from statsByCategory).
 */
function mockStores(
  routines: RoutineWithSteps[],
  opts: {
    stepMByKey?: Record<string, number>;
    statsByCategory?: Record<string, { mEffective: number }>;
    archetypeSeed?: ArchetypeSeed;
  } = {},
) {
  const stepMByKey = opts.stepMByKey ?? {};
  const statsByCategory = opts.statsByCategory ?? {};
  const archetypeSeed = opts.archetypeSeed;

  (useRoutinesStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: { routines: RoutineWithSteps[]; stepMByKey: Record<string, number> }) => unknown) =>
      sel({ routines, stepMByKey }),
  );

  (useCalibrationStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: { statsByCategory: Record<string, { mEffective: number }> }) => unknown) =>
      sel({ statsByCategory }),
  );

  (useSettingsStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: { archetypeSeed: ArchetypeSeed | undefined }) => unknown) => sel({ archetypeSeed }),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useScheduledRoutines', () => {
  /**
   * 2026-06-24 is a Wednesday (weekday 3).
   * All tests pin to this date.
   */
  const WEDNESDAY = '2026-06-24';
  const THURSDAY = '2026-06-25';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('a routine scheduled for the selected weekday', () => {
    it('yields one block with the correct honest total', () => {
      // Wednesday = 3
      const routine = makeRoutine({
        id: 'r1',
        name: 'Morning flow',
        scheduleDays: [3], // Wednesday
        doneByMinuteOfDay: 480, // 8:00
        steps: [
          { id: 's1', category: 'admin', guessMin: 10 },
          { id: 's2', category: 'admin', guessMin: 20 },
        ],
      });

      // M=1.0 for both steps → honestMinutes = round5(guess×1) → 10 and 20
      // transitionFactor=1.0 → total = round5((10+20)×1) = 30
      mockStores([routine], {
        stepMByKey: {
          'routine:r1:s1': 1.0,
          'routine:r1:s2': 1.0,
        },
      });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));

      expect(result.current.blocks).toHaveLength(1);
      const block = result.current.blocks[0]!;
      expect(block.routineId).toBe('r1');
      expect(block.name).toBe('Morning flow');
      expect(block.honestTotalMin).toBe(30);
    });

    it('computes startByMin = doneByMinuteOfDay - honestTotalMin', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'Morning flow',
        scheduleDays: [3],
        doneByMinuteOfDay: 480, // 8:00 = 480 min
        steps: [{ id: 's1', category: 'admin', guessMin: 30 }],
      });

      // M=1.0 → honest = 30; total = round5(30×1.0) = 30
      // startByMin = 480 - 30 = 450  (= 7:30)
      mockStores([routine], { stepMByKey: { 'routine:r1:s1': 1.0 } });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));

      expect(result.current.blocks[0]?.startByMin).toBe(450);
    });

    it('includes step summaries in the block', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'Morning flow',
        scheduleDays: [3],
        doneByMinuteOfDay: 480,
        steps: [
          { id: 's1', category: 'admin', guessMin: 15 },
          { id: 's2', category: 'focus', guessMin: 25 },
        ],
      });

      mockStores([routine], {
        stepMByKey: {
          'routine:r1:s1': 1.0,
          'routine:r1:s2': 1.0,
        },
      });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      const block = result.current.blocks[0]!;

      expect(block.steps).toHaveLength(2);
      // honestNumber(15, 1.0) → round to nearest 5 = 15
      expect(block.steps[0]?.honestMin).toBe(15);
      expect(block.steps[0]?.label).toBe('Step 1');
      // honestNumber(25, 1.0) → round to nearest 5 = 25
      expect(block.steps[1]?.honestMin).toBe(25);
    });

    it('falls back to category M when no step M in cache', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'Morning flow',
        scheduleDays: [3],
        doneByMinuteOfDay: 600,
        steps: [{ id: 's1', category: 'admin', guessMin: 20 }],
      });

      // No stepMByKey → fallback to statsByCategory
      // M=2.0 for admin → honestNumber(20, 2.0) = round5(40) = 40; total=40; startBy=600-40=560
      mockStores([routine], {
        stepMByKey: {},
        statsByCategory: { admin: { mEffective: 2.0 } },
      });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      expect(result.current.blocks[0]?.honestTotalMin).toBe(40);
      expect(result.current.blocks[0]?.startByMin).toBe(560);
    });

    it('falls back to the SEEDED prior (not the population prior) for a cold category', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'Morning flow',
        scheduleDays: [3],
        doneByMinuteOfDay: 480,
        steps: [{ id: 's1', category: 'creative', guessMin: 20 }],
      });

      // No stepMByKey entry and no statsByCategory entry for 'creative' → the hook
      // must fall through to seededPriorFor, not the raw priorFor.
      mockStores([routine]);
      const { result: unseeded } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      const unseededTotal = unseeded.current.blocks[0]!.honestTotalMin;

      mockStores([routine], { archetypeSeed: { m0: 3.0, source: 'quiz', tookAt: 1 } });
      const { result: seeded } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      const seededTotal = seeded.current.blocks[0]!.honestTotalMin;

      expect(seededTotal).not.toBe(unseededTotal);
    });

    it('returns startByMin = null when doneByMinuteOfDay is null', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'No anchor',
        scheduleDays: [3],
        doneByMinuteOfDay: null, // no anchor
        steps: [{ id: 's1', category: 'admin', guessMin: 20 }],
      });

      mockStores([routine], { stepMByKey: { 'routine:r1:s1': 1.0 } });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      expect(result.current.blocks[0]?.startByMin).toBeNull();
    });

    it('returns startByMin = null when there are no steps', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'Empty routine',
        scheduleDays: [3],
        doneByMinuteOfDay: 480,
        steps: [],
      });

      mockStores([routine]);

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      expect(result.current.blocks[0]?.startByMin).toBeNull();
    });
  });

  describe('a routine NOT scheduled for the selected weekday', () => {
    it('yields no block when the routine is scheduled for a different day', () => {
      // scheduleDays=[4] = Thursday; selectedDate is Wednesday (weekday 3)
      const routine = makeRoutine({
        id: 'r1',
        name: 'Thu only',
        scheduleDays: [4],
        doneByMinuteOfDay: 480,
        steps: [{ id: 's1', category: 'admin', guessMin: 10 }],
      });

      mockStores([routine], { stepMByKey: { 'routine:r1:s1': 1.0 } });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      expect(result.current.blocks).toHaveLength(0);
    });

    it('yields a block when the same date is the matching weekday', () => {
      // Thursday routine on Thursday
      const routine = makeRoutine({
        id: 'r1',
        name: 'Thu routine',
        scheduleDays: [4],
        doneByMinuteOfDay: null,
        steps: [{ id: 's1', category: 'admin', guessMin: 10 }],
      });

      mockStores([routine], { stepMByKey: { 'routine:r1:s1': 1.0 } });

      const { result } = renderHook(() => useScheduledRoutines(THURSDAY));
      expect(result.current.blocks).toHaveLength(1);
    });
  });

  describe('an unscheduled routine (empty scheduleDays)', () => {
    it('yields no block', () => {
      const routine = makeRoutine({
        id: 'r1',
        name: 'No schedule',
        scheduleDays: [],
        doneByMinuteOfDay: 480,
        steps: [{ id: 's1', category: 'admin', guessMin: 20 }],
      });

      mockStores([routine], { stepMByKey: { 'routine:r1:s1': 1.0 } });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      expect(result.current.blocks).toHaveLength(0);
    });
  });

  describe('multiple routines — mixed schedule', () => {
    it('returns only routines matching the weekday', () => {
      const wed = makeRoutine({
        id: 'wed',
        name: 'Wed only',
        scheduleDays: [3],
        doneByMinuteOfDay: 480,
        steps: [{ id: 'sw', category: 'admin', guessMin: 15 }],
      });
      const thu = makeRoutine({
        id: 'thu',
        name: 'Thu only',
        scheduleDays: [4],
        doneByMinuteOfDay: 540,
        steps: [{ id: 'st', category: 'admin', guessMin: 15 }],
      });
      const both = makeRoutine({
        id: 'both',
        name: 'Wed+Thu',
        scheduleDays: [3, 4],
        doneByMinuteOfDay: null,
        steps: [{ id: 'sb', category: 'admin', guessMin: 10 }],
      });

      mockStores([wed, thu, both], {
        stepMByKey: {
          'routine:wed:sw': 1.0,
          'routine:thu:st': 1.0,
          'routine:both:sb': 1.0,
        },
      });

      const { result } = renderHook(() => useScheduledRoutines(WEDNESDAY));
      const ids = result.current.blocks.map((b) => b.routineId);
      expect(ids).toContain('wed');
      expect(ids).toContain('both');
      expect(ids).not.toContain('thu');
    });
  });
});
