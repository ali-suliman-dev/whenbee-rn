import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { usePlanStore } from '@/src/stores/planStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';

describe('store reset actions', () => {
  it('categoriesStore.reset empties the tracked list', () => {
    useCategoriesStore.getState().setCategories([{ id: 'a', name: 'A', adaptSpeed: 'balanced' }]);
    useCategoriesStore.getState().reset();
    expect(useCategoriesStore.getState().categories).toEqual([]);
  });

  it('settingsStore.reset returns prefs to defaults', () => {
    useSettingsStore.getState().setColorMode('dark');
    useSettingsStore.getState().setRemindersEnabled(true);
    useSettingsStore.getState().setDailyRitualEnabled(true);
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.colorMode).toBe('system');
    expect(s.remindersEnabled).toBe(false);
    expect(s.dailyRitualEnabled).toBe(false);
  });

  it('vocabStore.reset clears the learned map', () => {
    useVocabStore.getState().bank('clean kitchen', 'cleaning');
    useVocabStore.getState().reset();
    expect(useVocabStore.getState().map).toEqual({});
    expect(useVocabStore.getState().seq).toBe(0);
  });

  it('planStore.reset drops the active plan and draft', () => {
    usePlanStore.getState().setDeadline(123);
    usePlanStore.getState().reset();
    expect(usePlanStore.getState().active).toBeNull();
    expect(usePlanStore.getState().draft.deadline).toBeNull();
  });

  it('calibrationStore.reset clears in-memory caches', () => {
    useCalibrationStore.setState({
      logs: 5,
      statsByCategory: { a: { mEffective: 1, n: 2, sharpness: 0.1, tier: 'Raw' } },
      graduatedCategories: new Set(['a']),
    });
    useCalibrationStore.getState().reset();
    const c = useCalibrationStore.getState();
    expect(c.logs).toBe(0);
    expect(c.statsByCategory).toEqual({});
    expect(c.graduatedCategories.size).toBe(0);
  });
});
