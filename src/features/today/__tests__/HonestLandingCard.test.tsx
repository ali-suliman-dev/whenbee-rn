// Render tests for HonestLandingCard — the four landing states.
//
// The load-bearing one is 'past': it renders NO bar on purpose. Past end of day
// the bar could only ever be 100% amber, which turns the calmest state into the
// loudest thing on the screen — guilt by accident. The no-guilt invariant
// outranks visual consistency, so the absence of the bar is pinned here.

import { render, screen, fireEvent } from '@testing-library/react-native';
import { HonestLandingCard } from '@/src/features/today/HonestLandingCard';
import type { HonestLandingResult } from '@/src/features/today/useHonestLanding';

const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const MIN = 60_000;
const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

const base = (over: Partial<HonestLandingResult['landing']> = {}): HonestLandingResult => ({
  landing: {
    kind: 'over',
    landingMs: NOW + 160 * MIN,
    overMin: 50,
    openMin: 0,
    remainingMin: 160,
    tail: { id: 'c', label: 'Draft the deck', honestMin: 90 },
    ends: [],
    ...over,
  },
  range: null,
  logsToWarm: 0,
  dayEndMs: DAY_END,
  nowMs: NOW,
});

test('renders the landing headline and the tail footer when over', () => {
  render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  // "~9:50pm" is the headline's clock span; the bare "9:50pm" also appears on the
  // bar scale, so match the tilde to pin the headline specifically.
  expect(screen.getByText(/~9:50pm/)).toBeTruthy();
  expect(screen.getByText(/Draft the deck lands after 9/)).toBeTruthy();
});

test('renders nothing at all on an empty day', () => {
  const empty = base({ kind: 'empty', landingMs: null, remainingMin: 0, tail: null });
  const { toJSON } = render(
    <HonestLandingCard result={empty} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(toJSON()).toBeNull();
});

test('past end of day renders NO bar — a 100% amber bar would read as a scold', () => {
  const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null });
  render(
    <HonestLandingCard result={past} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.queryByTestId('landing-bar')).toBeNull();
  expect(screen.getByText(/Your day ended/)).toBeTruthy();
});

test('the over bar has both an in-day and an overflow segment', () => {
  render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.getByTestId('landing-seg-in')).toBeTruthy();
  expect(screen.getByTestId('landing-seg-over')).toBeTruthy();
});

test('the bar scale anchors the present moment — bare clocks would say nothing', () => {
  render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  expect(screen.getByText('now · 7:10pm')).toBeTruthy();
  expect(screen.getByText('9:00pm')).toBeTruthy();
});

test('the clear bar has no overflow segment', () => {
  const clear = base({ kind: 'clear', landingMs: NOW + 60 * MIN, overMin: 0, openMin: 50, tail: null });
  render(
    <HonestLandingCard result={clear} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(screen.queryByTestId('landing-seg-over')).toBeNull();
});

describe('the footer action reports which route the caller should take', () => {
  it('offers to move the tail when the day runs over', () => {
    const onAction = jest.fn();
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText(/Move it/));
    expect(onAction).toHaveBeenCalledWith('move-tail');
  });

  it('offers a log first while the estimate is still cold', () => {
    const onAction = jest.fn();
    const cold: HonestLandingResult = { ...base(), logsToWarm: 3 };
    render(
      <HonestLandingCard result={cold} doneCount={0} doneHonestMin={0} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText(/Start one/));
    expect(onAction).toHaveBeenCalledWith('start-one');
  });

  it('offers tomorrow once the day is already over', () => {
    const onAction = jest.fn();
    const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null });
    render(
      <HonestLandingCard result={past} doneCount={2} doneHonestMin={75} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText(/Move 0 to tomorrow/));
    expect(onAction).toHaveBeenCalledWith('move-to-tomorrow');
  });

  it('offers a task when the day is clear', () => {
    const onAction = jest.fn();
    const clear = base({ kind: 'clear', landingMs: NOW + 60 * MIN, overMin: 0, openMin: 50, tail: null });
    render(
      <HonestLandingCard result={clear} doneCount={0} doneHonestMin={0} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText(/Add a task/));
    expect(onAction).toHaveBeenCalledWith('add-task');
  });
});

test('a cold estimate speaks the range, not a single minute', () => {
  const cold: HonestLandingResult = {
    ...base(),
    range: { lowMs: NOW + 120 * MIN, highMs: NOW + 200 * MIN },
    logsToWarm: 3,
  };
  render(
    <HonestLandingCard result={cold} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(screen.getByText(/9:10pm – 10:30pm/)).toBeTruthy();
});
