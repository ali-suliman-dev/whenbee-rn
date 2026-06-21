import { render } from '@testing-library/react-native';
import { ArchetypeHero } from '../Archetype';

it('renders the personality title and average multiplier', () => {
  const { getAllByText } = render(
    <ArchetypeHero card={{ title: 'The Gentle Optimist', blurb: 'You lean hopeful.', averageMultiplier: 1.6, provisional: false }} />,
  );
  // ShareableCard (off-screen capture) also renders the title — use getAllByText.
  expect(getAllByText('The Gentle Optimist').length).toBeGreaterThan(0);
  expect(getAllByText(/1\.6×/).length).toBeGreaterThan(0);
});
