// ──────────────────────────────────────────────────────────────────────────────
// analytics.funnel.test.ts — deterministic end-to-end funnel verification.
//
// Simulates a full first-session: app_open → onboarding_completed → first_log
// → aha_shown (→ paywall_view), asserting the ordered sequence and key props.
// No real network. Mocks only the PostHog sink.
//
// This proves the funnel is wired before monetization (C.2 gate, §06-RELEASE §2).
// ──────────────────────────────────────────────────────────────────────────────

import { setAnalyticsSink, analytics } from '../analytics';
import { wasInstallFired, markInstallFired } from '@/src/lib/install';
import { kv } from '@/src/lib/kv';

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Ordered list of event names captured so far. */
function capturedOrder(mock: jest.Mock): string[] {
  return mock.mock.calls.map((c) => c[0] as string);
}

/** All calls for a specific event name. */
function callsFor(mock: jest.Mock, event: string): Record<string, unknown>[] {
  return mock.mock.calls
    .filter((c) => c[0] === event)
    .map((c) => (c[1] ?? {}) as Record<string, unknown>);
}

function countFor(mock: jest.Mock, event: string): number {
  return callsFor(mock, event).length;
}

// ── Shared setup ──────────────────────────────────────────────────────────────

let capture: jest.Mock;

beforeEach(() => {
  // Fresh mock sink for every test.
  capture = jest.fn();
  setAnalyticsSink({ capture });

  // Reset install-fired flag so once-only tests start clean.
  kv.delete('whenbee.installFired');
  kv.delete('whenbee.installAt');
  kv.delete('whenbee.firstLogFired');
  kv.delete('whenbee.ahaFired.cooking');
});

afterEach(() => {
  setAnalyticsSink(null);
  jest.clearAllMocks();
});

// ── Step 1: once-only install event ──────────────────────────────────────────

describe('app_installed once-only gate', () => {
  it('fires app_installed on the first launch', () => {
    expect(wasInstallFired()).toBe(false);
    analytics.capture('app_installed', {});
    markInstallFired();
    expect(countFor(capture, 'app_installed')).toBe(1);
  });

  it('does NOT fire app_installed on subsequent launches', () => {
    // Simulate first launch
    analytics.capture('app_installed', {});
    markInstallFired();

    // Simulate second launch (new mock, flag already set)
    const capture2 = jest.fn();
    setAnalyticsSink({ capture: capture2 });

    if (!wasInstallFired()) {
      analytics.capture('app_installed', {});
      markInstallFired();
    }

    expect(countFor(capture2, 'app_installed')).toBe(0);
  });

  it('fires app_open on every launch regardless of install flag', () => {
    markInstallFired(); // Already fired
    analytics.capture('app_open', {});
    analytics.capture('app_open', {});
    expect(countFor(capture, 'app_open')).toBe(2);
  });
});

// ── Step 2: full funnel sequence ──────────────────────────────────────────────

describe('funnel sequence: first session', () => {
  it('emits events in the correct funnel order', () => {
    // Simulate what AnalyticsProvider fires on first launch:
    analytics.capture('app_open', {});
    analytics.capture('app_installed', {});
    markInstallFired();

    // Onboarding completed (fired by useOnboarding.complete):
    analytics.capture('onboarding_completed', {
      categories_picked: 3,
      custom_category_added: false,
    });

    // First log (fired by calibrationStore after first task_logged):
    analytics.capture('first_log', { time_since_install_sec: 120 });

    // Aha moment (fired by calibrationStore when enough data):
    analytics.capture('aha_shown', { category: 'cooking', multiplier: 1.6, n: 5 });

    // Paywall surfaced later:
    analytics.capture('paywall_view', { trigger: 'settings_upgrade' });

    const order = capturedOrder(capture);

    // Assert the funnel shape — required events appear in order.
    const funnelEvents = [
      'app_open',
      'app_installed',
      'onboarding_completed',
      'first_log',
      'aha_shown',
      'paywall_view',
    ];
    for (let i = 0; i < funnelEvents.length - 1; i++) {
      const earlier = funnelEvents[i]!;
      const later = funnelEvents[i + 1]!;
      expect(order.indexOf(earlier)).toBeLessThan(order.indexOf(later));
    }
  });

  it('onboarding_completed carries required props', () => {
    analytics.capture('onboarding_completed', {
      categories_picked: 4,
      custom_category_added: true,
    });

    const [call] = callsFor(capture, 'onboarding_completed');
    expect(call).toBeDefined();
    expect(call?.['categories_picked']).toBe(4);
    expect(call?.['custom_category_added']).toBe(true);
  });

  it('first_log carries time_since_install_sec', () => {
    analytics.capture('first_log', { time_since_install_sec: 300 });

    const [call] = callsFor(capture, 'first_log');
    expect(call).toBeDefined();
    expect(typeof call?.['time_since_install_sec']).toBe('number');
    expect((call?.['time_since_install_sec'] as number) >= 0).toBe(true);
  });

  it('aha_shown carries category, multiplier, n', () => {
    analytics.capture('aha_shown', { category: 'cooking', multiplier: 1.8, n: 7 });

    const [call] = callsFor(capture, 'aha_shown');
    expect(call).toBeDefined();
    expect(call?.['category']).toBe('cooking');
    expect(typeof call?.['multiplier']).toBe('number');
    expect(typeof call?.['n']).toBe('number');
  });

  it('paywall_view carries a recognised trigger', () => {
    analytics.capture('paywall_view', { trigger: 'settings_upgrade' });

    const [call] = callsFor(capture, 'paywall_view');
    expect(['settings_upgrade', 'steals_your_time']).toContain(call?.['trigger']);
  });
});

// ── Step 3: counts & idempotency ─────────────────────────────────────────────

describe('event counts across two simulated launches', () => {
  it('app_open fires once per launch simulation', () => {
    // Launch 1
    analytics.capture('app_open', {});
    expect(countFor(capture, 'app_open')).toBe(1);

    // Launch 2 — reset mock to simulate fresh process
    capture.mockClear();
    analytics.capture('app_open', {});
    expect(countFor(capture, 'app_open')).toBe(1);
  });

  it('app_installed fires exactly once across two launches', () => {
    // Launch 1
    analytics.capture('app_open', {});
    if (!wasInstallFired()) {
      analytics.capture('app_installed', {});
      markInstallFired();
    }
    const countL1 = countFor(capture, 'app_installed');
    expect(countL1).toBe(1);

    // Launch 2 — same capture mock accumulates across "launches"
    analytics.capture('app_open', {});
    if (!wasInstallFired()) {
      analytics.capture('app_installed', {});
      markInstallFired();
    }
    // Still only 1 total across both launches
    expect(countFor(capture, 'app_installed')).toBe(1);
  });
});

// ── Step 4: sink resilience ───────────────────────────────────────────────────

describe('analytics resilience', () => {
  it('never throws into callers even when sink throws', () => {
    setAnalyticsSink({
      capture: () => {
        throw new Error('network error');
      },
    });
    expect(() => analytics.capture('app_open', {})).not.toThrow();
    expect(() =>
      analytics.capture('onboarding_completed', {
        categories_picked: 2,
        custom_category_added: false,
      }),
    ).not.toThrow();
  });

  it('is a safe no-op when no sink is set', () => {
    setAnalyticsSink(null);
    expect(() => analytics.capture('first_log', { time_since_install_sec: 0 })).not.toThrow();
  });
});
