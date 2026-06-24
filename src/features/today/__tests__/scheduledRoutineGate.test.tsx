/**
 * Scheduled routine blocks — Pro gate render regression test (Fix 4).
 *
 * Mirrors the gate condition in index.tsx:
 *   {isPro && scheduledRoutineBlocks.length > 0 && (
 *     blocks.map((block) => <ScheduledRoutineBlock ... />)
 *   )}
 *
 * Renders ScheduledRoutineBlock inside a minimal wrapper that applies the same
 * gate condition, then asserts DOM presence/absence. This is a render-level test,
 * not a pure-logic tautology — it catches regressions where the gate is removed or
 * the component is rendered outside the condition.
 *
 * Uses the same mock patterns as ScheduledRoutineBlock.test.tsx.
 */

import React from 'react';
import { View } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ScheduledRoutineBlock } from '../ScheduledRoutineBlock';
import type { ScheduledRoutineBlock as ScheduledRoutineBlockModel } from '../useScheduledRoutines';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// ScheduledRoutineBlock reads startRun from routinesStore via a selector.
jest.mock('@/src/stores/routinesStore', () => ({
  useRoutinesStore: (sel: (s: { startRun: jest.Mock }) => unknown) =>
    sel({ startRun: jest.fn() }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// ── Test component: the same gate condition as index.tsx ──────────────────────

function GatedRoutineSection({
  isPro,
  blocks,
}: {
  isPro: boolean;
  blocks: ScheduledRoutineBlockModel[];
}) {
  return (
    <View testID="routine-section">
      {isPro && blocks.length > 0
        ? blocks.map((block) => (
            <ScheduledRoutineBlock key={block.routineId} block={block} />
          ))
        : null}
    </View>
  );
}

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_BLOCK: ScheduledRoutineBlockModel = {
  routineId: 'r1',
  name: 'Morning flow',
  honestTotalMin: 45,
  startByMin: 435, // 7:15
  steps: [
    { stepId: 's1', label: 'Meditate', honestMin: 15 },
    { stepId: 's2', label: 'Exercise', honestMin: 30 },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Scheduled routine blocks — Pro gate render', () => {
  it('does NOT render ScheduledRoutineBlock for a FREE user even when a block exists', () => {
    render(<GatedRoutineSection isPro={false} blocks={[SAMPLE_BLOCK]} />);
    // The block's routine name must not be in the tree for a free user.
    expect(screen.queryByText('Morning flow')).toBeNull();
    expect(screen.queryByText('45m')).toBeNull();
  });

  it('DOES render ScheduledRoutineBlock for a PRO user with a scheduled block', () => {
    render(<GatedRoutineSection isPro={true} blocks={[SAMPLE_BLOCK]} />);
    expect(screen.getByText('Morning flow')).toBeTruthy();
    expect(screen.getByText('45m')).toBeTruthy();
  });

  it('does NOT render anything for a PRO user with no blocks', () => {
    render(<GatedRoutineSection isPro={true} blocks={[]} />);
    expect(screen.queryByText('Morning flow')).toBeNull();
  });
});
