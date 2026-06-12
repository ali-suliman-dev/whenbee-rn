import { createAnalytics, setAnalyticsSink, analytics } from '../analytics';

describe('analytics', () => {
  afterEach(() => setAnalyticsSink(null));

  it('no-ops safely when no client is set', () => {
    const a = createAnalytics(null);
    expect(() => a.capture('app_open', {})).not.toThrow();
  });

  it('forwards typed events to the client', () => {
    const capture = jest.fn();
    const a = createAnalytics({ capture });
    a.capture('onboarding_completed', { categories_picked: 3, custom_category_added: false });
    expect(capture).toHaveBeenCalledWith('onboarding_completed', {
      categories_picked: 3,
      custom_category_added: false,
    });
  });

  it('forwards through the module-level sink once set', () => {
    const capture = jest.fn();
    setAnalyticsSink({ capture });
    analytics.capture('first_log', { time_since_install_sec: 42 });
    expect(capture).toHaveBeenCalledWith('first_log', { time_since_install_sec: 42 });
  });

  it('never throws into the caller even when the sink throws', () => {
    setAnalyticsSink({
      capture: () => {
        throw new Error('sink exploded');
      },
    });
    expect(() => analytics.capture('app_open', {})).not.toThrow();
  });
});
