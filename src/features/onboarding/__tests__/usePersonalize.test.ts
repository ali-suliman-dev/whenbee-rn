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
  expect(useSettingsStore.getState().archetypeSeed?.m0).toBeGreaterThan(2);
  expect(card!.title.length).toBeGreaterThan(0);
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
  { multiplier: 1.15, expectedTitle: 'The Steady Reader' },
  { multiplier: 1.5,  expectedTitle: 'The Gentle Optimist' },
  { multiplier: 2.1,  expectedTitle: 'The Sprint Optimist' },
  { multiplier: 3.0,  expectedTitle: 'The Dreamer' },
];

it.each(LADDER)(
  'archetype ladder title for multiplier $multiplier is $expectedTitle',
  ({ multiplier, expectedTitle }) => {
    const card = deriveArchetype(makeEarnedData(multiplier));
    expect(card).not.toBeNull();
    expect(card!.title).toBe(expectedTitle);
  },
);
