import { renderHook, act } from '@testing-library/react-native';
import { useDayEndSetting } from '../useDayEndSetting';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { startOfLocalDay } from '@/src/lib/time';

describe('useDayEndSetting', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it('labels the default day-end as 9:00pm', () => {
    const { result } = renderHook(() => useDayEndSetting());
    expect(result.current.label).toBe('9:00pm');
  });

  it('commit converts an epoch-on-today to minutes-after-midnight and closes', () => {
    const { result } = renderHook(() => useDayEndSetting());
    const tenPm = startOfLocalDay(Date.now()) + 22 * 60 * 60_000; // 22:00 today
    act(() => result.current.open());
    act(() => result.current.commit(tenPm));
    expect(useSettingsStore.getState().dayEndMin).toBe(22 * 60);
    expect(result.current.editing).toBe(false);
  });
});
