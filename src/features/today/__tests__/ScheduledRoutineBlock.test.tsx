// TDD: ScheduledRoutineBlock component
// Verify: shows name + total + start-by time
// Verify: expands to show steps on press
// Verify: Run affordance present

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ScheduledRoutineBlock } from '../ScheduledRoutineBlock';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/src/stores/routinesStore', () => ({
  useRoutinesStore: jest.fn((sel: (s: { startRun: jest.Mock }) => unknown) =>
    sel({ startRun: jest.fn() }),
  ),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// ── Helpers ──────────────────────────────────────────────────────────────────

const BLOCK = {
  routineId: 'r1',
  name: 'Morning flow',
  honestTotalMin: 45,
  startByMin: 435, // 7:15 in minutes of day (7*60 + 15)
  steps: [
    { stepId: 's1', label: 'Meditate', honestMin: 15 },
    { stepId: 's2', label: 'Exercise', honestMin: 30 },
  ],
};

const BLOCK_NO_ANCHOR = {
  ...BLOCK,
  startByMin: null,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ScheduledRoutineBlock', () => {
  it('renders the routine name', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    expect(screen.getByText('Morning flow')).toBeTruthy();
  });

  it('renders the honest total minutes', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    expect(screen.getByText('45m')).toBeTruthy();
  });

  it('renders the start-by clock when startByMin is set', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    // 435 min = 7h15 = "7:15 AM"
    expect(screen.getByText(/7:15/)).toBeTruthy();
  });

  it('does not render a start-by time when startByMin is null', () => {
    render(<ScheduledRoutineBlock block={BLOCK_NO_ANCHOR} />);
    expect(screen.queryByText(/AM|PM/)).toBeNull();
  });

  it('does not show steps initially (collapsed)', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    expect(screen.queryByText('Meditate')).toBeNull();
    expect(screen.queryByText('Exercise')).toBeNull();
  });

  it('expands to show steps when pressed', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    // Press the block to expand
    fireEvent.press(screen.getByTestId('routine-block-header'));
    expect(screen.getByText('Meditate')).toBeTruthy();
    expect(screen.getByText('Exercise')).toBeTruthy();
  });

  it('collapses back when pressed again', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    fireEvent.press(screen.getByTestId('routine-block-header'));
    expect(screen.getByText('Meditate')).toBeTruthy();
    fireEvent.press(screen.getByTestId('routine-block-header'));
    expect(screen.queryByText('Meditate')).toBeNull();
  });

  it('renders a Run affordance', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    // Run button is visible even when collapsed
    expect(screen.getByTestId('routine-block-run-btn')).toBeTruthy();
  });

  it('calls startRun when Run is pressed', () => {
    const mockStartRun = jest.fn().mockResolvedValue(undefined);
    const { useRoutinesStore: mockStore } = require('@/src/stores/routinesStore');
    (mockStore as jest.Mock).mockImplementation(
      (sel: (s: { startRun: jest.Mock }) => unknown) => sel({ startRun: mockStartRun }),
    );

    render(<ScheduledRoutineBlock block={BLOCK} />);
    fireEvent.press(screen.getByTestId('routine-block-run-btn'));

    expect(mockStartRun).toHaveBeenCalledWith('r1');
  });

  it('shows per-step honest minutes when expanded', () => {
    render(<ScheduledRoutineBlock block={BLOCK} />);
    fireEvent.press(screen.getByTestId('routine-block-header'));
    expect(screen.getByText('15m')).toBeTruthy();
    expect(screen.getByText('30m')).toBeTruthy();
  });
});
