import { renderHook, act } from '@testing-library/react-native';
import { usePersonalize } from '../usePersonalize';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { deriveArchetype } from '../../patterns/usePatterns';
import type { PatternsData, PatternCategoryStat } from '@/src/stores/calibrationStore';

beforeEach(() => useSettingsStore.getState().reset());

it('persists the seed and returns a reveal card from quiz answers', () => {
  const { result } = renderHook(() => usePersonalize());
  let card: { title: string; multiplier: number } | undefined;
  act(() => { card = result.current.saveQuiz({ pace: 'lot', mid: 'rabbit' }); });
  // lot (1.7) × rabbit bump (1.15) ≈ 1.96 → Sprint rung.
  expect(useSettingsStore.getState().archetypeSeed?.m0).toBeCloseTo(1.955, 2);
  expect(card!.title).toBe('The Sprint Optimist');
});

it('persists the sink answer on the seed so the engine can bump that category', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => {
    result.current.saveQuiz({ pace: 'lot', mid: 'rabbit', sink: 'deepwork', focus: 'morning' });
  });
  expect(useSettingsStore.getState().archetypeSeed).toMatchObject({ sink: 'deepwork', source: 'quiz' });
});

it('omits sink when the question was not answered', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => { result.current.saveQuiz({ pace: 'lot' }); });
  expect(useSettingsStore.getState().archetypeSeed?.sink).toBeUndefined();
});

it('persists a name and clears on undefined', () => {
  const { result } = renderHook(() => usePersonalize());
  act(() => result.current.saveName('Ali'));
  expect(useSettingsStore.getState().displayName).toBe('Ali');
});

// ── ladder parity guard ────────────────────────────────────────────────────────
// rungFor (usePersonalize) and archetypeFor (usePatterns) share identical thresholds
// and titles. This test drives deriveArchetype into its earned path at representative
// multipliers so that if either ladder drifts the test breaks — forcing a deliberate
// sync.

function makeEarnedData(avgMultiplier: number): PatternsData {
  const cat = (id: string, m: number): PatternCategoryStat => ({
    categoryId: id,
    n: 7,
    mEffective: m,
    sharpness: 60,
  });
  return {
    categories: [cat('a', avgMultiplier), cat('b', avgMultiplier)],
    logs: [],
    nameOf: (id) => id,
  };
}

const LADDER: { multiplier: number; expectedTitle: string }[] = [
  { multiplier: 1.1,  expectedTitle: 'The Steady Reader' },
  { multiplier: 1.35, expectedTitle: 'The Gentle Optimist' },
  { multiplier: 1.7,  expectedTitle: 'The Sprint Optimist' },
  { multiplier: 2.2,  expectedTitle: 'The Dreamer' },
];

it.each(LADDER)(
  'archetype ladder title for multiplier $multiplier is $expectedTitle',
  ({ multiplier, expectedTitle }) => {
    const card = deriveArchetype(makeEarnedData(multiplier));
    expect(card).not.toBeNull();
    expect(card!.title).toBe(expectedTitle);
  },
);
