import { render, screen } from '@testing-library/react-native';
import { HonestCard } from '@/src/features/category-detail/HonestCard';

const base = {
  categoryName: 'Cleaning',
  honestMinutes: 30,
  multiplier: 2.0,
  provenance: 'based on your runs',
  tier: 'Setting',
  n: 4,
  logsToNext: 2,
  nextTier: 'Ripening' as const,
};

describe('HonestCard — range vs tight number', () => {
  it('shows the band and a learning line for raw confidence', () => {
    render(
      <HonestCard {...base} confidence="raw" range={{ lowMinutes: 20, highMinutes: 40 }} />,
    );
    expect(screen.getByText('20–40')).toBeOnTheScreen();
    expect(screen.getByText(/Still learning your pace/)).toBeOnTheScreen();
    // No tight number / multiplier while learning.
    expect(screen.queryByText('~30')).toBeNull();
    expect(screen.queryByText('runs 2.0×')).toBeNull();
  });

  it('shows the band and a clearer learning line for setting confidence', () => {
    render(
      <HonestCard {...base} confidence="setting" range={{ lowMinutes: 25, highMinutes: 35 }} />,
    );
    expect(screen.getByText('25–35')).toBeOnTheScreen();
    expect(screen.getByText(/Getting clearer/)).toBeOnTheScreen();
  });

  it('shows the tight number, multiplier, and honest affirmation once honest', () => {
    render(<HonestCard {...base} confidence="honest" range={null} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 2.0×')).toBeOnTheScreen();
    expect(screen.getByText('Now an honest number')).toBeOnTheScreen();
    // No band when honest.
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it('falls back to the tight number when confidence is omitted (back-compat)', () => {
    render(<HonestCard {...base} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('runs 2.0×')).toBeOnTheScreen();
    expect(screen.queryByText('Now an honest number')).toBeNull();
  });
});
