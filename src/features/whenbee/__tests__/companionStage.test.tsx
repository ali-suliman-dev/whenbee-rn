import { render } from '@testing-library/react-native';
import { companionStageFor, capabilityFor } from '@/src/engine';
import { TierTrailHub } from '../TierTrailHub';

describe('companion stage mapping (unit)', () => {
  it('Keeper node is the 6th trail node', () => {
    const TRAIL = ['Raw', 'Setting', 'Ripening', 'Thickening', 'Honest', 'Keeper'];
    expect(TRAIL).toHaveLength(6);
    expect(TRAIL[5]).toBe('Keeper');
  });
  it('avatar variant id matches the engine stage 1..6', () => {
    expect(`stage-${companionStageFor({ maxTier: 0, keeper: false })}`).toBe('stage-1');
    expect(`stage-${companionStageFor({ maxTier: 4, keeper: true })}`).toBe('stage-6');
  });
  it('Keeper capability gates nothing new', () => {
    expect(capabilityFor(6).gatesNewFeature).toBe(false);
  });
});

describe('TierTrailHub trail mapping', () => {
  it('stage 3 marks Raw/Setting done, Ripening now, rest ahead', () => {
    const { getByLabelText } = render(<TierTrailHub stage={3} />);
    expect(getByLabelText('Raw: done')).toBeTruthy();
    expect(getByLabelText('Ripening: now')).toBeTruthy();
    expect(getByLabelText('Keeper: ahead')).toBeTruthy();
  });
});
