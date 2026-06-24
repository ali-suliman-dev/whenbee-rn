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

it('renders the hero multiplier read and a share button', () => {
  const { getByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'x', averageMultiplier: 1.5, provisional: true }} />,
  );
  // The hero is the jeweled multiplier with an honest, guilt-free one-liner.
  expect(getByText('longer than you guess')).toBeTruthy();
  expect(getByText(/share my archetype/i)).toBeTruthy();
});

it('surfaces LEARNED stats from the calibration map even with no quiz answers', () => {
  const { getByText } = render(
    <ArchetypeHero
      card={{ title: 'The Gentle Optimist', blurb: 'x', averageMultiplier: 1.5, provisional: false }}
      calibrationMap={[
        { categoryId: 'email', categoryName: 'Email', guessMin: 15, honestMin: 16, multiplier: 1.05, sampleSize: 4, confidence: 'honest' },
        { categoryId: 'reports', categoryName: 'Reports', guessMin: 15, honestMin: 29, multiplier: 1.9, sampleSize: 8, confidence: 'honest' },
      ]}
    />,
  );
  expect(getByText('Tracked')).toBeTruthy();
  expect(getByText('12 tasks')).toBeTruthy();
  expect(getByText('Most accurate')).toBeTruthy();
  expect(getByText('Runs longest')).toBeTruthy();
  expect(getByText('Reports')).toBeTruthy();
});

it('renders the placeholder invite with a quiz CTA', () => {
  const onTakeQuiz = jest.fn();
  const { getByText } = render(<ArchetypePlaceholder onTakeQuiz={onTakeQuiz} />);
  fireEvent.press(getByText(/take the 20-sec quiz/i));
  expect(onTakeQuiz).toHaveBeenCalled();
});
