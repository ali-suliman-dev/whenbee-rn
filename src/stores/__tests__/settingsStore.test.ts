import { useSettingsStore } from '../settingsStore';
import { DEFAULT_DAY_END_MIN } from '@/src/engine/constants';

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
