import { render, screen } from '@testing-library/react-native';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';

describe('HonestSuggestionCard — optional range support', () => {
  it('renders the tight line when no confidence/range is provided (live-guess banner)', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText('~25')).toBeOnTheScreen();
    expect(screen.getByText('+10m')).toBeOnTheScreen();
    expect(screen.queryByText('still learning')).toBeNull();
  });

  it('renders the band + still-learning suffix when learning confidence + range given', () => {
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

  it('keeps the tight line when confidence is honest even if a range is passed', () => {
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
