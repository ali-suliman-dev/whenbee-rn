import { render, screen } from '@testing-library/react-native';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

const NBSP = ' ';

function setPro(isPro: boolean) {
  useEntitlement.setState({ isPro, ready: true });
}

afterEach(() => setPro(false));

describe('HonestSuggestionCard — pre-data (starting hunch)', () => {
  it('sentence-first: eyebrow, guess note, inline range value, dont-pad footer', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={35}
        guessMinutes={15}
        preEstimate
        range={{ lowMinutes: 25, highMinutes: 45 }}
      />,
    );
    expect(screen.getByText('A starting hunch')).toBeOnTheScreen();
    expect(screen.getByText('you guessed 15m')).toBeOnTheScreen();
    expect(screen.getByText(/Tasks like this usually land around/)).toBeOnTheScreen();
    expect(screen.getByText(`25–45${NBSP}min`)).toBeOnTheScreen();
    expect(
      screen.getByText('No need to pad your guess. This range does it for you. Sharpens as you log.'),
    ).toBeOnTheScreen();
    // Old chunky elements are gone.
    expect(screen.queryByText(/often run a bit longer/)).toBeNull();
    expect(screen.queryByText(/optimists like you/)).toBeNull();
    expect(screen.queryByText(/~/)).toBeNull();
  });

  it('falls back to the point value pre-data when no range is present', () => {
    render(<HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate />);
    expect(screen.getByText(`35${NBSP}min`)).toBeOnTheScreen();
  });
});

describe('HonestSuggestionCard — trained (usually, for you)', () => {
  it('folds provenance into the sentence and keeps the gut footer', () => {
    render(
      <HonestSuggestionCard honestMinutes={25} guessMinutes={15} categoryName="Email" />,
    );
    expect(screen.getByText('Usually, for you')).toBeOnTheScreen();
    expect(screen.getByText(/Your last few email tasks landed around/)).toBeOnTheScreen();
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(
      screen.getByText('Not a target, just what usually happens. Keep guessing with your gut.'),
    ).toBeOnTheScreen();
  });

  it('falls back to "similar" when no category name is given', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText(/Your last few similar tasks landed around/)).toBeOnTheScreen();
  });

  it('formats hour-scale values in the sentence', () => {
    render(<HonestSuggestionCard honestMinutes={95} guessMinutes={60} />);
    expect(screen.getByText('1h 35m')).toBeOnTheScreen();
  });

  it('no legacy delta / arrow / locked-range affordance', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.queryByText('+10m')).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });

  it('renders the inline value at the sentence size (AppText default would shrink it)', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText(`25${NBSP}min`)).toHaveStyle({ fontSize: 16 });
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
    expect(screen.getByText(`20–30${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`25${NBSP}min`)).toBeNull();
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
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`20–30${NBSP}min`)).toBeNull();
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
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`20–30${NBSP}min`)).toBeNull();
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
