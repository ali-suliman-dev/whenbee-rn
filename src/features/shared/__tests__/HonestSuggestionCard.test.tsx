import { render, screen } from '@testing-library/react-native';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

function setPro(isPro: boolean) {
  useEntitlement.setState({ isPro, ready: true });
}

afterEach(() => setPro(false));

describe('HonestSuggestionCard — pre-estimate label', () => {
  it('shows the pre-estimate line when preEstimate and no reasonNote', () => {
    const { queryByText } = render(
      <HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate />,
    );
    expect(queryByText('Starting estimate · sharpens as you log')).toBeTruthy();
  });

  it('hides it once calibrated (preEstimate false)', () => {
    const { queryByText } = render(
      <HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate={false} />,
    );
    expect(queryByText('Starting estimate · sharpens as you log')).toBeNull();
  });

  it('reasonNote takes priority over the pre-estimate line', () => {
    const { queryByText } = render(
      <HonestSuggestionCard
        honestMinutes={35}
        guessMinutes={15}
        preEstimate
        reasonNote="Afternoons run long"
      />,
    );
    expect(queryByText('Starting estimate · sharpens as you log')).toBeNull();
    expect(queryByText('Afternoons run long')).toBeTruthy();
  });
});

describe('HonestSuggestionCard — Pro-gated honest range', () => {
  it('renders the tight line when no confidence/range is provided (live-guess banner)', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('+10m')).toBeOnTheScreen();
    expect(screen.queryByText('still learning')).toBeNull();
  });

  it('shows the band + still-learning suffix for Pro when learning confidence + range given', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    expect(screen.getByText('20–30')).toBeOnTheScreen();
    expect(screen.getByText('still learning')).toBeOnTheScreen();
    // The tight number is suppressed when the band shows.
    expect(screen.queryByText('~25')).toBeNull();
  });

  it('hides the band from free users and shows the locked Range affordance instead', () => {
    setPro(false);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    // Free users keep the point number; the real range numbers never leak.
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.queryByText('20–30')).toBeNull();
    expect(screen.getByText('Range')).toBeOnTheScreen();
  });

  it('shows a roughly caption (no band) for Pro at the raw state', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="raw"
        range={{ lowMinutes: 15, highMinutes: 40 }}
      />,
    );
    expect(screen.getByText('Still learning — roughly 15–40m')).toBeOnTheScreen();
  });

  it('keeps the tight line when confidence is honest even if a range is passed', () => {
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
    expect(screen.queryByText('still learning')).toBeNull();
  });
});
