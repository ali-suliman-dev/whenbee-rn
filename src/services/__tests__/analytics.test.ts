import { createAnalytics } from '../analytics';
describe('analytics', () => {
  it('no-ops safely when no client is set', () => { const a = createAnalytics(null); expect(() => a.capture('app_open', {})).not.toThrow(); });
  it('forwards events to the client', () => { const capture = jest.fn(); const a = createAnalytics({ capture } as never); a.capture('onboarding_complete', { steps: 3 }); expect(capture).toHaveBeenCalledWith('onboarding_complete', { steps: 3 }); });
});
