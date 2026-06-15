import { runShareFlow } from '../useShareCard';

describe('runShareFlow', () => {
  const capture = jest.fn();
  beforeEach(() => capture.mockClear());

  it('gates non-Pro: never captures, never shares, routes to paywall', async () => {
    const onGate = jest.fn();
    const share = jest.fn();
    const captureRef = jest.fn();
    await runShareFlow({
      surface: 'plan',
      isPro: false,
      ref: { current: {} },
      onGate,
      share,
      captureRef,
      capture,
    });
    expect(captureRef).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(onGate).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith('plan_shared', {
      surface: 'plan',
      is_pro: false,
      result: 'gated',
    });
  });

  it('Pro path: captures the ref and shares the URI, reports shared', async () => {
    const share = jest.fn(async () => 'shared' as const);
    const captureRef = jest.fn(async () => 'file:///tmp/plan.png');
    await runShareFlow({
      surface: 'archetype',
      isPro: true,
      ref: { current: {} },
      onGate: jest.fn(),
      share,
      captureRef,
      capture,
    });
    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith('file:///tmp/plan.png');
    expect(capture).toHaveBeenCalledWith('plan_shared', {
      surface: 'archetype',
      is_pro: true,
      result: 'shared',
    });
  });

  it('does nothing when the ref is empty', async () => {
    const share = jest.fn();
    const captureRef = jest.fn();
    await runShareFlow({
      surface: 'plan',
      isPro: true,
      ref: { current: null },
      onGate: jest.fn(),
      share,
      captureRef,
      capture,
    });
    expect(captureRef).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  });

  it('reports error and never throws when capture fails', async () => {
    const captureRef = jest.fn(async () => {
      throw new Error('capture failed');
    });
    await expect(
      runShareFlow({
        surface: 'plan',
        isPro: true,
        ref: { current: {} },
        onGate: jest.fn(),
        share: jest.fn(),
        captureRef,
        capture,
      }),
    ).resolves.toBeUndefined();
    expect(capture).toHaveBeenCalledWith('plan_shared', {
      surface: 'plan',
      is_pro: true,
      result: 'error',
    });
  });
});
