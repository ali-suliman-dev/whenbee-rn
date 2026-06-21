import { useSettingsStore } from '../settingsStore';
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

describe('settingsStore displayName + archetype seed', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('stores and clears a display name', () => {
    useSettingsStore.getState().setDisplayName('Ali');
    expect(useSettingsStore.getState().displayName).toBe('Ali');
    useSettingsStore.getState().setDisplayName(undefined);
    expect(useSettingsStore.getState().displayName).toBeUndefined();
  });

  it('stores an archetype seed and reset clears both', () => {
    useSettingsStore.getState().setArchetypeSeed({ m0: 2.1, source: 'quiz', tookAt: 1 });
    useSettingsStore.getState().setDisplayName('Ali');
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().archetypeSeed).toBeUndefined();
    expect(useSettingsStore.getState().displayName).toBeUndefined();
  });
});

describe('settingsStore dayEndMin', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('defaults to DEFAULT_DAY_END_MIN', () => {
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });

  it('setDayEndMin stores a valid in-range value', () => {
    useSettingsStore.getState().setDayEndMin(22 * 60);
    expect(useSettingsStore.getState().dayEndMin).toBe(22 * 60);
  });

  it('clamps below 0 to 0 and above 1439 to 1439', () => {
    useSettingsStore.getState().setDayEndMin(-5);
    expect(useSettingsStore.getState().dayEndMin).toBe(0);
    useSettingsStore.getState().setDayEndMin(99999);
    expect(useSettingsStore.getState().dayEndMin).toBe(1439);
  });

  it('falls back to the default on a non-finite value', () => {
    useSettingsStore.getState().setDayEndMin(Number.NaN);
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });

  it('reset restores the default', () => {
    useSettingsStore.getState().setDayEndMin(8 * 60);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().dayEndMin).toBe(DEFAULT_DAY_END_MIN);
  });
});

describe('settingsStore focus window', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('defaults to unset (null/null)', () => {
    expect(useSettingsStore.getState().windowStartMin).toBeNull();
    expect(useSettingsStore.getState().windowEndMin).toBeNull();
  });

  it('setFocusWindow stores both', () => {
    useSettingsStore.getState().setFocusWindow(540, 720);
    expect(useSettingsStore.getState().windowStartMin).toBe(540);
    expect(useSettingsStore.getState().windowEndMin).toBe(720);
  });

  it('clamps to [0,1439]', () => {
    useSettingsStore.getState().setFocusWindow(-10, 99999);
    expect(useSettingsStore.getState().windowStartMin).toBe(0);
    expect(useSettingsStore.getState().windowEndMin).toBe(1439);
  });

  it('reset clears to null', () => {
    useSettingsStore.getState().setFocusWindow(540, 720);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().windowStartMin).toBeNull();
    expect(useSettingsStore.getState().windowEndMin).toBeNull();
  });
});

describe('settingsStore hyperfocusGuard', () => {
  beforeEach(() => useSettingsStore.getState().reset());
  it('defaults to off', () => expect(useSettingsStore.getState().hyperfocusGuard).toBe('off'));
  it('sets a value', () => {
    useSettingsStore.getState().setHyperfocusGuard('2x');
    expect(useSettingsStore.getState().hyperfocusGuard).toBe('2x');
  });
  it('reset restores off', () => {
    useSettingsStore.getState().setHyperfocusGuard('3x');
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().hyperfocusGuard).toBe('off');
  });
});
