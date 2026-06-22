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

it('renders the stat-sheet ledger (the multiplier row) and a share button', () => {
  const { getByText, getAllByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'x', averageMultiplier: 1.5, provisional: true }} />,
  );
  // The stat-sheet drops the provisional/"rare" badge by design — it always shows the
  // Runs row (the multiplier) plus a real Share pill below the card.
  expect(getByText('Runs')).toBeTruthy();
  expect(getAllByText(/1\.5× long/).length).toBeGreaterThan(0);
  expect(getByText(/share my archetype/i)).toBeTruthy();
});

it('renders the placeholder invite with a quiz CTA', () => {
  const onTakeQuiz = jest.fn();
  const { getByText } = render(<ArchetypePlaceholder onTakeQuiz={onTakeQuiz} />);
  fireEvent.press(getByText(/take the 20-sec quiz/i));
  expect(onTakeQuiz).toHaveBeenCalled();
});
