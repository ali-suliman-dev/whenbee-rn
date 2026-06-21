import { render, fireEvent } from '@testing-library/react-native';
import { ArchetypeHero, ArchetypePlaceholder } from '../Archetype';

it('renders the personality title and average multiplier', () => {
  const { getAllByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'You lean hopeful.', averageMultiplier: 1.6, provisional: false }} />,
  );
  // ShareableCard (off-screen capture) also renders the title — use getAllByText.
  expect(getAllByText('The Gentle Optimist').length).toBeGreaterThan(0);
  expect(getAllByText(/1\.6×/).length).toBeGreaterThan(0);
});

it('shows a provisional marker when the card is provisional', () => {
  const { getAllByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'x', averageMultiplier: 1.5, provisional: true }} />,
  );
  expect(getAllByText(/still learning/i).length).toBeGreaterThan(0);
});

it('renders the placeholder invite with a quiz CTA', () => {
  const onTakeQuiz = jest.fn();
  const { getByText } = render(<ArchetypePlaceholder onTakeQuiz={onTakeQuiz} />);
  fireEvent.press(getByText(/take the 20-sec quiz/i));
  expect(onTakeQuiz).toHaveBeenCalled();
});
