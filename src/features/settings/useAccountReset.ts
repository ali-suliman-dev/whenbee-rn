import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import { getDatabase } from '@/src/db';
import { wipeLearning, wipeEverything } from '@/src/services/dataReset';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useTasksStore } from '@/src/stores/tasksStore';
import { usePlanStore } from '@/src/stores/planStore';
import { useTimerStore } from '@/src/stores/timerStore';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { useVocabStore } from '@/src/stores/vocabStore';
import { useOnboardingStore } from '@/src/stores/onboardingStore';

/**
 * Drives the two Settings "Danger zone" resets. Clears persistence (db + kv) via
 * the dataReset service, then resets the matching in-memory Zustand stores so the
 * live UI reflects the wipe without a relaunch. Erase additionally drops the
 * boot-gate flag and bounces through the root → welcome onboarding.
 */
export function useAccountReset() {
  const [resetting, setResetting] = useState(false);

  const resetProgress = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const db = await getDatabase();
      await wipeLearning(db);
      // Session/learning caches → empty, then repopulate from the now-clean db.
      useTasksStore.getState().clear();
      usePlanStore.getState().reset();
      useTimerStore.getState().cancel();
      useCalibrationStore.getState().reset();
      await useCalibrationStore.getState().hydrate();
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  const eraseEverything = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const db = await getDatabase();
      await wipeEverything(db);
      useTasksStore.getState().clear();
      usePlanStore.getState().reset();
      useTimerStore.getState().cancel();
      useCalibrationStore.getState().reset();
      useCategoriesStore.getState().reset();
      useSettingsStore.getState().reset();
      useVocabStore.getState().reset();
      useOnboardingStore.getState().reset();
      router.replace('/'); // Index re-redirects to welcome (completed === false)
    } finally {
      setResetting(false);
    }
  }, [resetting]);

  return { resetting, resetProgress, eraseEverything };
}
