import { render, screen } from '@testing-library/react-native';
import { HonestCard } from '@/src/features/category-detail/HonestCard';

const base = {
  categoryName: 'Cleaning',
  honestMinutes: 30,
  multiplier: 2.0,
  provenance: 'based on your runs',
  tier: 'Setting',
  n: 2,
  logsToNext: 2,
  nextTier: 'Ripening' as const,
};

describe('HonestCard — range band hero', () => {
  it('shows the range, tier meaning, and maturity caption while learning (free)', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro={false} />);
    expect(screen.getByText('20–40')).toBeOnTheScreen();
    expect(screen.getByText('YOUR HONEST RANGE')).toBeOnTheScreen();
    expect(screen.getByText('still sharpening your pace')).toBeOnTheScreen();
    expect(screen.getByText(/4 more runs/)).toBeOnTheScreen();
    // Free: the convergence point is Pro-gated — the "lands near ~30" line never renders.
    expect(screen.queryByText('~30 min')).toBeNull();
    expect(screen.queryByText(/land near/)).toBeNull();
    // No tight number / multiplier chip while learning.
    expect(screen.queryByText('2.0')).toBeNull();
  });

  it('uses the raw tier meaning for raw confidence', () => {
    render(<HonestCard {...base} n={1} confidence="raw" range={{ lowMinutes: 20, highMinutes: 45 }} />);
    expect(screen.getByText('just getting to know your pace')).toBeOnTheScreen();
  });

  it('shows the narrowing proof for Pro with a wider prior range', () => {
    render(
      <HonestCard
        {...base}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 40 }}
        isPro
        firstHonestRange={{ lowMinutes: 10, highMinutes: 55 }}
      />,
    );
    expect(screen.getByText(/Tightened from 10–55/)).toBeOnTheScreen();
  });

  it('shows the tight number, multiplier, and affirmation once honest', () => {
    render(<HonestCard {...base} confidence="honest" range={null} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    // A design: multiplier folds into the quiet meta line ("2.0× your guess").
    expect(screen.getByText('2.0×')).toBeOnTheScreen();
    expect(screen.getByText('honest now')).toBeOnTheScreen();
    // A design: eyebrow removed — the number speaks for itself.
    expect(screen.queryByText('YOUR HONEST NUMBER')).toBeNull();
  });

  it('falls back to the tight number when confidence is omitted (back-compat)', () => {
    render(<HonestCard {...base} />);
    expect(screen.getByText('~30')).toBeOnTheScreen();
    expect(screen.getByText('2.0×')).toBeOnTheScreen();
    // Not honest → no seal in the meta line.
    expect(screen.queryByText('honest now')).toBeNull();
  });

  it('shows the honest point line for Pro once setting', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro />);
    // round_to_5(15 × 2.0) style point = honestMinutes (30) → "~30 min".
    expect(screen.getByText('~30 min')).toBeOnTheScreen();
    expect(screen.getByText(/land near/)).toBeOnTheScreen();
  });

  it('hides the honest point line from free users (Pro gate)', () => {
    render(<HonestCard {...base} confidence="setting" range={{ lowMinutes: 20, highMinutes: 40 }} isPro={false} />);
    expect(screen.queryByText('~30 min')).toBeNull();
  });

  it('hides the honest point line at raw even for Pro (too few logs to assert)', () => {
    render(<HonestCard {...base} n={1} confidence="raw" range={{ lowMinutes: 20, highMinutes: 45 }} isPro />);
    expect(screen.queryByText('~30 min')).toBeNull();
    expect(screen.queryByText(/land near/)).toBeNull();
  });
});
