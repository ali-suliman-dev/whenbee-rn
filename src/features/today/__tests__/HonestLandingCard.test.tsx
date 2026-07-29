// Render tests for HonestLandingCard — the four landing states.
//
// The load-bearing one is 'past': it renders NO bar on purpose. Past end of day
// the bar could only ever be 100% amber, which turns the calmest state into the
// loudest thing on the screen — guilt by accident. The no-guilt invariant
// outranks visual consistency, so the absence of the bar is pinned here.

import { render, screen, fireEvent } from '@testing-library/react-native';
import { HonestLandingCard } from '@/src/features/today/HonestLandingCard';
import type { HonestLandingResult } from '@/src/features/today/useHonestLanding';
import { setLandingVariant, LANDING_VARIANT_KEY } from '@/src/features/today/useLandingVariant';
import { LANDING_COLLAPSE_KEY, writeLandingCollapsed } from '@/src/features/today/landingCollapse';
import { kv } from '@/src/lib/kv';

// Entitlement mock — overridden per-test via mockEntitlement. Defaults to free
// so every pre-existing test (written before Pro status mattered here) keeps
// exercising the free path unless it opts into Pro.
let mockIsPro = false;
function mockEntitlement({ isPro }: { isPro: boolean }) {
  mockIsPro = isPro;
}
jest.mock('@/src/features/paywall/useEntitlement', () => ({
  useEntitlement: (sel: (s: Record<string, unknown>) => unknown) => sel({ isPro: mockIsPro }),
}));
afterEach(() => {
  mockIsPro = false;
});

const NOW = new Date(2026, 6, 25, 19, 10).getTime();
const MIN = 60_000;
const DAY_END = new Date(2026, 6, 25, 21, 0).getTime();

// The cumulative finishes that come with a 'past' day. The engine only emits
// 'past' while work is still queued — `remainingMin: 115` with an EMPTY `ends`
// is a state it cannot produce, so fixtures must carry the rows the minutes are
// made of or they pin behaviour ("Move 0 to tomorrow") that can never happen.
const PAST_ENDS = [
  { id: 'a', endMs: NOW + 55 * MIN },
  { id: 'b', endMs: NOW + 115 * MIN },
];

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
  const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null, ends: PAST_ENDS });
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

  it('never asks for more logs — a cold estimate leaves the footer to the day fact', () => {
    const onAction = jest.fn();
    const cold: HonestLandingResult = { ...base(), logsToWarm: 3 };
    render(
      <HonestLandingCard result={cold} doneCount={0} doneHonestMin={0} onAction={onAction} />,
    );
    expect(screen.queryByText(/more logs/)).toBeNull();
    expect(screen.queryByText(/Start one/)).toBeNull();
  });

  it('offers tomorrow once the day is already over — counting the rows it would move', () => {
    const onAction = jest.fn();
    const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null, ends: PAST_ENDS });
    render(
      <HonestLandingCard result={past} doneCount={2} doneHonestMin={75} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText('Move 2 to tomorrow'));
    expect(onAction).toHaveBeenCalledWith('move-to-tomorrow');
  });

  it('offers nothing at all when there is nothing the offer could move', () => {
    // Defensive: the engine no longer emits 'past' with an empty queue, but a
    // tappable "Move 0 to tomorrow" that does nothing must never be renderable.
    const nothingToMove = base({ kind: 'past', overMin: 90, remainingMin: 0, tail: null, ends: [] });
    render(
      <HonestLandingCard
        result={nothingToMove}
        doneCount={2}
        doneHonestMin={75}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/to tomorrow/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers a task when the day is clear and something has been logged', () => {
    const onAction = jest.fn();
    const clear = base({ kind: 'clear', landingMs: NOW + 60 * MIN, overMin: 0, openMin: 50, tail: null });
    render(
      <HonestLandingCard result={clear} doneCount={2} doneHonestMin={75} onAction={onAction} />,
    );
    fireEvent.press(screen.getByText(/Add a task/));
    expect(onAction).toHaveBeenCalledWith('add-task');
  });

  it('renders no footer row — and no stray divider — before the first log', () => {
    // "Nothing logged yet · Add a task" named an absence and duplicated an
    // affordance Today already carries. The row is gone, so the divider that
    // introduced it must go with it or the card ends on a hairline.
    const clear = base({ kind: 'clear', landingMs: NOW + 60 * MIN, overMin: 0, openMin: 50, tail: null });
    mockEntitlement({ isPro: true });
    render(
      <HonestLandingCard
        result={clear}
        doneCount={0}
        doneHonestMin={0}
        eventMinAhead={0}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/Nothing logged yet/)).toBeNull();
    expect(screen.queryByText(/Add a task/)).toBeNull();
    expect(screen.queryByTestId('landing-divider')).toBeNull();
  });
});

describe('the stored landing variant switches the headline wording', () => {
  afterEach(() => kv.delete(LANDING_VARIANT_KEY));

  test('defaults to the D wording when no variant is stored', () => {
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.getByText(/Done ~9:50pm · 50m past your day/)).toBeTruthy();
    expect(screen.queryByText(/~9:50pm\. That's 50m past your day\./)).toBeNull();
  });

  test('renders the D-alt wording once the variant is set to dAlt', () => {
    setLandingVariant('dAlt');
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.getByText(/~9:50pm\. That's 50m past your day\./)).toBeTruthy();
    expect(screen.queryByText(/Done ~9:50pm · 50m past your day/)).toBeNull();
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

test('a cold estimate keeps the exact landing OFF the scale too', () => {
  // The bar still runs to the point estimate, but naming "9:50pm" two lines under
  // a headline that just disclaimed the minute would contradict it in words.
  const cold: HonestLandingResult = {
    ...base(),
    range: { lowMs: NOW + 120 * MIN, highMs: NOW + 200 * MIN },
    logsToWarm: 3,
  };
  render(
    <HonestLandingCard result={cold} doneCount={0} doneHonestMin={0} onAction={jest.fn()} />,
  );
  expect(screen.getByText('now · 7:10pm')).toBeTruthy();
  expect(screen.getByText('9:00pm')).toBeTruthy();
  expect(screen.queryByText('9:50pm')).toBeNull();
});

// ── Pro: same component, more data ───────────────────────────────────────────
// Meetings are committed time INSIDE the same now→landing span, so they take a
// slice out of the in-day segment rather than lengthening the bar. A Pro user
// who denies calendar permission passes 0 and lands back on the free card.

test('Pro with booked time renders a third bar segment and the booked-time action', () => {
  const onAction = jest.fn();
  mockEntitlement({ isPro: true });
  const clear = base({
    kind: 'clear',
    landingMs: NOW + 60 * MIN,
    overMin: 0,
    openMin: 50,
    tail: null,
  });
  render(
    <HonestLandingCard
      result={clear}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={90}
      onAction={onAction}
    />,
  );
  expect(screen.getByTestId('landing-seg-meet')).toBeTruthy();
  // eventMinAhead (90m) exceeds the 60m still open before the landing, so the
  // bar/legend's booked slice clamps to 1h — but the footer states the TRUE
  // total (1h 30m), and the action button itself is now the short verb
  // "Pad calendar", not the amount. See the `meetMs`/`bookedMinAll` split.
  expect(screen.getByText('1h 30m already booked today')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Pad calendar'));
  expect(onAction).toHaveBeenCalledWith('pad-calendar');
});

test('the meetings slice comes out of the in-day segment, it does not extend the bar', () => {
  mockEntitlement({ isPro: true });
  const clear = base({
    kind: 'clear',
    landingMs: NOW + 60 * MIN,
    overMin: 0,
    openMin: 50,
    tail: null,
  });
  const free = render(
    <HonestLandingCard result={clear} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
  );
  const freeIn = free.getByTestId('landing-seg-in').props.style.flex;
  free.unmount();

  render(
    <HonestLandingCard
      result={clear}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={30}
      onAction={jest.fn()}
    />,
  );
  const proIn = screen.getByTestId('landing-seg-in').props.style.flex;
  const meet = screen.getByTestId('landing-seg-meet').props.style.flex;
  expect(meet).toBe(30 * MIN);
  expect(proIn).toBe(freeIn - meet);
});

test('Pro without meetings renders exactly the free card', () => {
  mockEntitlement({ isPro: true });
  const onAction = jest.fn();
  const free = render(
    <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={onAction} />,
  ).toJSON();
  const withZero = render(
    <HonestLandingCard
      result={base()}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={0}
      onAction={onAction}
    />,
  ).toJSON();
  expect(screen.queryByTestId('landing-seg-meet')).toBeNull();
  // Serialised rather than deep-equalled: two render trees are structurally
  // identical but never `toEqual` (each carries its own renderer internals).
  expect(JSON.stringify(withZero)).toBe(JSON.stringify(free));
});

test('the tail offer still wins over Pad calendar once the day runs over', () => {
  mockEntitlement({ isPro: true });
  const onAction = jest.fn();
  render(
    <HonestLandingCard
      result={base()}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={90}
      onAction={onAction}
    />,
  );
  fireEvent.press(screen.getByText(/Move it/));
  expect(onAction).toHaveBeenCalledWith('move-tail');
});

// Ported from the deleted CapacityChip test suite: the Pro day-read used to be
// the one place a "you're behind" word could creep in. The card inherits that
// guard now that it is the only day-read on Today.
test('never scolds a Pro user whose day runs over', () => {
  mockEntitlement({ isPro: true });
  render(
    <HonestLandingCard
      result={base()}
      doneCount={2}
      doneHonestMin={75}
      eventMinAhead={90}
      onAction={jest.fn()}
    />,
  );
  expect(screen.queryByText(/overdue/i)).toBeNull();
  expect(screen.queryByText(/behind/i)).toBeNull();
  expect(screen.queryByText(/failed/i)).toBeNull();
});

// ── Collapse: remembered open/closed state via kv ────────────────────────────
// The header row is the touch target; collapsing hides the bar/scale/divider/
// footer but never the headline. 'past' has no bar to hide, so it gets no
// toggle at all and stays always-expanded.

describe('the collapse state is remembered via kv', () => {
  afterEach(() => kv.delete(LANDING_COLLAPSE_KEY));

  it('hides the bar and footer when collapsed', () => {
    writeLandingCollapsed(true);
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.getByText(/~9:50pm/)).toBeTruthy();
    expect(screen.queryByTestId('landing-bar')).toBeNull();
    expect(screen.queryByText(/Draft the deck lands after 9/)).toBeNull();
  });

  it('reveals the bar and footer when the header is pressed', () => {
    writeLandingCollapsed(true);
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    fireEvent.press(screen.getByRole('button', { name: /~9:50pm/ }));
    expect(screen.getByTestId('landing-bar')).toBeTruthy();
    expect(screen.getByText(/Draft the deck lands after 9/)).toBeTruthy();
  });

  it('renders no toggle in the past state', () => {
    const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null, ends: PAST_ENDS });
    render(
      <HonestLandingCard result={past} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /roughly done/i })).toBeNull();
  });

  // The header comment says "Nothing animates on entrance" — an ordinary mount
  // (expanded by default, nothing pressed yet) must never carry an `entering`
  // animation, or the card would fade in on every visit to Today. It only
  // becomes a "reveal" once the user has actually pressed the header.
  it('does not animate the body on an ordinary expanded mount', () => {
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.getByTestId('landing-body').props.entering).toBeUndefined();
  });

  it('animates the body in only once the user presses the header to reveal it', () => {
    writeLandingCollapsed(true);
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.queryByTestId('landing-body')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /~9:50pm/ }));
    expect(screen.getByTestId('landing-body').props.entering).toBeDefined();
  });
});

// ── Legend: explains what the bar's colours mean ─────────────────────────────
// Rendered only once booked time exists, directly under the scale row — the
// scale keeps anchoring the bar in time, the legend just explains its colours.

describe('the legend explains the bar colours once booked time exists', () => {
  it('shows the legend once calendar time exists', () => {
    mockEntitlement({ isPro: true });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={120}
        onAction={jest.fn()}
      />,
    );
    expect(screen.getByText('booked')).toBeTruthy();
  });

  it('renders no legend at all when the day has no booked time', () => {
    mockEntitlement({ isPro: true });
    render(
      <HonestLandingCard result={base()} doneCount={2} doneHonestMin={75} onAction={jest.fn()} />,
    );
    expect(screen.queryByText('booked')).toBeNull();
    expect(screen.queryByText('tasks')).toBeNull();
  });

  it('drops the "tasks" legend entry (and its indigo dot) when booked time fully swallows the in-day segment — nothing indigo is on the bar to explain', () => {
    mockEntitlement({ isPro: true });
    const clear = base({
      kind: 'clear',
      landingMs: NOW + 30 * MIN, // 30m still open before the landing
      overMin: 0,
      openMin: 50,
      tail: null,
    });
    render(
      <HonestLandingCard
        result={clear}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={90} // clamps to the full 30m in-day span — no room for tasks
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('landing-seg-in')).toBeNull();
    expect(screen.getByText('booked')).toBeTruthy();
    expect(screen.queryByText('tasks')).toBeNull();
  });
});

// ── Free upsell: offers the calendar without ever inventing a bar segment ────

describe('the free upsell offers the calendar without gating on a fabricated bar segment', () => {
  it('offers the calendar to a free user with tasks queued', () => {
    mockEntitlement({ isPro: false });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={0}
        onAction={jest.fn()}
      />,
    );
    expect(screen.getByText(/Assumes an empty calendar/)).toBeTruthy();
  });

  it('never offers it on a past day', () => {
    const past = base({ kind: 'past', overMin: 90, remainingMin: 115, tail: null, ends: PAST_ENDS });
    mockEntitlement({ isPro: false });
    render(
      <HonestLandingCard
        result={past}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={0}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/Assumes an empty calendar/)).toBeNull();
  });

  it('never offers it to a Pro user with calendar on', () => {
    mockEntitlement({ isPro: true });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={120}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/Assumes an empty calendar/)).toBeNull();
  });

  it('never offers it to a Pro user whose calendar is off', () => {
    // A Pro user who denied calendar access gets the degraded free bar, but is
    // still Pro — the upsell would be selling them what they already own.
    mockEntitlement({ isPro: true });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={0}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByText(/Assumes an empty calendar/)).toBeNull();
  });

  it('renders no bar segment for the un-purchased calendar', () => {
    mockEntitlement({ isPro: false });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={0}
        onAction={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('landing-seg-meet')).toBeNull();
  });

  it('routes the action to connect-calendar', () => {
    const onAction = jest.fn();
    mockEntitlement({ isPro: false });
    render(
      <HonestLandingCard
        result={base()}
        doneCount={2}
        doneHonestMin={75}
        eventMinAhead={0}
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByText('Add mine'));
    expect(onAction).toHaveBeenCalledWith('connect-calendar');
  });
});
