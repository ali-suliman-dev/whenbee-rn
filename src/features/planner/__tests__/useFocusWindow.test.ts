import { renderHook, act } from '@testing-library/react-native';
import { useFocusWindow } from '../useFocusWindow';
import { usePlanStore } from '@/src/stores/planStore';
import { useDayTasksStore } from '@/src/stores/dayTasksStore';
import { useCalibrationStore } from '@/src/stores/calibrationStore';
import { useSettingsStore } from '@/src/stores/settingsStore';
import { DEFAULT_BUFFER_MIN, DEFAULT_BREATHER_MIN } from '@/src/engine';

function resetStores() {
  usePlanStore.setState({
    draft: { deadline: null, bufferMin: DEFAULT_BUFFER_MIN, breatherMin: DEFAULT_BREATHER_MIN, tasks: [] },
    active: null,
  });
  useDayTasksStore.setState({ dayTasks: [] });
  useCalibrationStore.setState({ logs: 0, statsByCategory: {} });
  useSettingsStore.getState().reset();
}

beforeEach(resetStores);

function seedDraftTask(id: string, label: string, durationMin: number) {
  usePlanStore.setState((s) => ({
    draft: {
      ...s.draft,
      tasks: [
        ...s.draft.tasks,
        { id, label, category: 'admin', durationMin, suggestedHonestMin: durationMin, status: 'upcoming' },
      ],
    },
  }));
}

describe('useFocusWindow', () => {
  it('returns null result + hasWindow false when the window is unset', () => {
    const { result } = renderHook(() => useFocusWindow());
    expect(result.current.result).toBeNull();
    expect(result.current.hasWindow).toBe(false);
  });

  it('computes a fit result once a window is set', () => {
    act(() => {
      useSettingsStore.getState().setFocusWindow(540, 720); // 180m window
    });
    seedDraftTask('a', 'A', 90);
    seedDraftTask('b', 'B', 40);
    const { result } = renderHook(() => useFocusWindow());
    expect(result.current.hasWindow).toBe(true);
    expect(result.current.result?.verdict).toBe('fits');
    expect(result.current.result?.fitCount).toBe(2);
  });

  it('reports spills when planned work exceeds the window', () => {
    act(() => {
      useSettingsStore.getState().setFocusWindow(540, 670); // 130m window
    });
    seedDraftTask('a', 'A', 90);
    seedDraftTask('b', 'B', 40);
    seedDraftTask('c', 'C', 50);
    const { result } = renderHook(() => useFocusWindow());
    expect(result.current.result?.verdict).toBe('spills');
    expect(result.current.result?.spilled.map((p) => p.id)).toEqual(['c']);
  });

  it('promote moves a spilled task into the window', () => {
    act(() => {
      useSettingsStore.getState().setFocusWindow(540, 670); // 130m window
    });
    seedDraftTask('a', 'A', 90);
    seedDraftTask('b', 'B', 40);
    seedDraftTask('c', 'C', 50);
    const { result } = renderHook(() => useFocusWindow());
    act(() => {
      result.current.promote('c');
    });
    expect(result.current.result?.inWindow.some((p) => p.id === 'c')).toBe(true);
  });

  it('excludes done tasks from the fit', () => {
    act(() => {
      useSettingsStore.getState().setFocusWindow(540, 720);
    });
    useDayTasksStore.setState({
      dayTasks: [
        {
          id: 't1',
          label: 'Done thing',
          category: 'admin',
          guessMin: 20,
          plannedDate: '2026-06-24',
          orderIndex: 0,
          doneByMin: null,
          createdAt: 0,
          status: 'done',
          completedAt: 1,
          actualMin: null,
          fromRoutineId: null,
          calendarEventId: null,
          carriedFrom: null,
        },
      ],
    });
    const { result } = renderHook(() => useFocusWindow());
    expect(result.current.result?.totalCount).toBe(0);
  });
});
