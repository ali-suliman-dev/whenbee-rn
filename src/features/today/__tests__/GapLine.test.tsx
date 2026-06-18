import { render, screen } from '@testing-library/react-native';
import { GapLine } from '@/src/features/today/GapLine';

describe('GapLine', () => {
  it('renders a guess segment and an amber overrun segment', () => {
    render(<GapLine guessMin={15} honestMin={35} />);
    expect(screen.getByTestId('gapline-guess')).toBeOnTheScreen();
    expect(screen.getByTestId('gapline-extra')).toBeOnTheScreen();
  });
});
