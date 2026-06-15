import { render, screen } from '@testing-library/react-native';
import { ShareableCard, type PlanShareData, type ArchetypeShareData } from '../ShareableCard';

describe('ShareableCard', () => {
  const plan: PlanShareData = {
    kind: 'plan',
    focalClock: new Date(2026, 0, 1, 7, 5).getTime(),
    eyebrow: 'YOUR HONEST PLAN',
    deadlineClock: new Date(2026, 0, 1, 9, 0).getTime(),
    timeline: [
      { id: 'a', label: 'Make breakfast', startAt: new Date(2026, 0, 1, 7, 5).getTime(), endAt: new Date(2026, 0, 1, 7, 35).getTime() },
    ],
  };

  const archetype: ArchetypeShareData = {
    kind: 'archetype',
    title: 'The Hopeful Sprinter',
    blurb: 'You guess fast and finish thoughtfully.',
    averageMultiplier: 1.52,
  };

  it('renders the plan variant: eyebrow, deadline, and a timeline row', () => {
    render(<ShareableCard data={plan} />);
    expect(screen.getByText('YOUR HONEST PLAN')).toBeTruthy();
    expect(screen.getByText('to finish by 9:00')).toBeTruthy();
    expect(screen.getByText('Make breakfast')).toBeTruthy();
    expect(screen.getByText('Made with Whenbee · learned on-device')).toBeTruthy();
  });

  it('renders the archetype variant: title, blurb, and rounded average multiplier', () => {
    render(<ShareableCard data={archetype} />);
    expect(screen.getByText('MY TIME ARCHETYPE')).toBeTruthy();
    expect(screen.getByText('The Hopeful Sprinter')).toBeTruthy();
    // The average line interpolates (toFixed rounds 1.45 → "1.5"), so RN splits it
    // across text segments. Assert on the serialized tree rather than one node.
    expect(JSON.stringify(screen.toJSON())).toContain('1.5');
    expect(JSON.stringify(screen.toJSON())).toContain('my first guess.');
  });
});
