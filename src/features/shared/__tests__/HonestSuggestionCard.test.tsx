import { render, screen } from '@testing-library/react-native';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

function setPro(isPro: boolean) {
  useEntitlement.setState({ isPro, ready: true });
}

afterEach(() => setPro(false));

describe('HonestSuggestionCard — pre-data (starting hunch)', () => {
  it('shows the starting-hunch eyebrow, the reframe headline, and the soft-range provenance', () => {
    render(<HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate />);
    expect(screen.getByText('A starting hunch')).toBeOnTheScreen();
    expect(screen.getByText('you guessed 15m')).toBeOnTheScreen();
    expect(
      screen.getByText('Tasks like this often run a bit longer than they feel.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('a rough range from optimists like you · sharpens as you log'),
    ).toBeOnTheScreen();
    // The pre-data headline carries the reframe, so the divider line is absent.
    expect(
      screen.queryByText(/Not a target/),
    ).toBeNull();
  });

  it('shows a soft RANGE (not a precise point) pre-data when a range is present', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={35}
        guessMinutes={15}
        preEstimate
        range={{ lowMinutes: 25, highMinutes: 45 }}
      />,
    );
    expect(screen.getByText('~25–45')).toBeOnTheScreen();
    expect(screen.queryByText('~35')).toBeNull();
  });
});

describe('HonestSuggestionCard — trained (usually, for you)', () => {
  it('shows the point number, category-grounded provenance, and the not-a-goal line', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        categoryName="Email"
      />,
    );
    expect(screen.getByText('Usually, for you')).toBeOnTheScreen();
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('min')).toBeOnTheScreen();
    expect(screen.getByText('from your last few email tasks')).toBeOnTheScreen();
    expect(
      screen.getByText('Not a target. Just what usually happens. Keep guessing with your gut.'),
    ).toBeOnTheScreen();
  });

  it('falls back to "similar" when no category name is given', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText('from your last few similar tasks')).toBeOnTheScreen();
  });

  it('no legacy delta / arrow / locked-range affordance', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.queryByText('+10m')).toBeNull();
    expect(screen.queryByText(/more/)).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });
});

describe('HonestSuggestionCard — Pro-gated tightening range', () => {
  it('shows the range for Pro while the category is still learning', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
        categoryName="Email"
      />,
    );
    expect(screen.getByText('~20–30')).toBeOnTheScreen();
    expect(screen.queryByText('~25')).toBeNull();
  });

  it('shows the point (never the range numbers) to free users, no upsell', () => {
    setPro(false);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.queryByText('~20–30')).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
  });

  it('keeps the point once the category has settled (honest), even for Pro', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="honest"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.queryByText('~20–30')).toBeNull();
  });
});

describe('HonestSuggestionCard — reasonNote', () => {
  it('renders a quiet extra line when a Pro reasonNote is present', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        reasonNote="Afternoons run long"
      />,
    );
    expect(screen.getByText('Afternoons run long')).toBeOnTheScreen();
  });
});
