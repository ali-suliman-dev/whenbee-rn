import { rewriteInitialTimerLink, consumePendingTimerHref } from '../timerDeepLinkGate';

beforeEach(() => {
  consumePendingTimerHref(); // drain any parked href from a previous test
});

describe('rewriteInitialTimerLink', () => {
  it('reroutes a bare notification body-tap link through Today and parks the sheet href', () => {
    expect(rewriteInitialTimerLink('/(modals)/timer')).toBe('/');
    expect(consumePendingTimerHref()).toBe('/(modals)/timer');
  });

  it('preserves query params (widget start link) on the parked href', () => {
    expect(rewriteInitialTimerLink('/timer?taskId=t1&label=Write%20report&estimateMin=42')).toBe('/');
    expect(consumePendingTimerHref()).toBe('/(modals)/timer?taskId=t1&label=Write%20report&estimateMin=42');
  });

  it('handles host-style scheme paths without a leading slash', () => {
    expect(rewriteInitialTimerLink('timer?taskId=t1')).toBe('/');
    expect(consumePendingTimerHref()).toBe('/(modals)/timer?taskId=t1');
  });

  it('leaves action=stop untouched — its handler is headless and needs no sheet', () => {
    expect(rewriteInitialTimerLink('/(modals)/timer?action=stop')).toBe('/(modals)/timer?action=stop');
    expect(consumePendingTimerHref()).toBeNull();
  });

  it('leaves non-timer paths untouched', () => {
    expect(rewriteInitialTimerLink('/(tabs)/patterns')).toBe('/(tabs)/patterns');
    expect(rewriteInitialTimerLink('/paywall')).toBe('/paywall');
    expect(rewriteInitialTimerLink('/timers')).toBe('/timers');
    expect(consumePendingTimerHref()).toBeNull();
  });

  it('consume is one-shot', () => {
    rewriteInitialTimerLink('/timer');
    expect(consumePendingTimerHref()).toBe('/(modals)/timer');
    expect(consumePendingTimerHref()).toBeNull();
  });
});
