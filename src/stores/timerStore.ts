import { create } from 'zustand';
import { kv } from '@/src/lib/kv';

const ACTIVE_TIMER_KEY = 'whenbee.activeTimer';

/**
 * Persisted shape for background-resume. Only a running timer is ever stored.
 * Carries the full calibration params (guess, taskId, the honest number the user
 * saw) so a session reopened after a full app close restores with no loss — these
 * are route params today, so the snapshot is the only place they survive a kill.
 */
interface PersistedTimer {
  taskLabel: string;
  /** null for quick-start sessions where category is captured at stop. */
  category: string | null;
  estimateMin: number;
  startedAt: number;
  pausedAccumMs: number;
  pausedAt: number | null;
  guessMin: number;
  taskId: string | null;
  suggestedHonestMin: number;
  /** Whether this session was started without a category (quick-start mode). */
  isQuickStart: boolean;
}

interface TimerState {
  taskLabel: string | null;
  /** null for quick-start sessions; non-null for normal starts. */
  category: string | null;
  estimateMin: number;
  startedAt: number | null;
  pausedAccumMs: number;
  pausedAt: number | null;
  isRunning: boolean;
  guessMin: number;
  taskId: string | null;
  suggestedHonestMin: number;
  /** True when the timer was started without a category (quick-start mode). */
  isQuickStart: boolean;
  start: (
    task: {
      label: string;
      category: string;
      estimateMin: number;
      guessMin?: number;
      taskId?: string | null;
      suggestedHonestMin?: number;
    },
    nowMs?: number,
  ) => void;
  /**
   * Start a bare timer with no category. The stop flow captures label + category
   * while context is fresh. Sets isQuickStart to true.
   */
  quickStart: (nowMs?: number) => void;
  pause: (nowMs?: number) => void;
  resume: (nowMs?: number) => void;
  /** Returns ACTIVE minutes (excludes paused spans), min 1. Clears state + kv. */
  stop: (nowMs: number) => { actualMin: number };
  /** Abandon path — clears state + kv, returns nothing. */
  cancel: () => void;
  /** Rehydrate from kv if a timer was running (background/crash-resume). */
  resumeFromKv: () => void;
}

const CLEARED = {
  taskLabel: null,
  category: null,
  estimateMin: 0,
  startedAt: null,
  pausedAccumMs: 0,
  pausedAt: null,
  isRunning: false,
  guessMin: 0,
  taskId: null,
  suggestedHonestMin: 0,
  isQuickStart: false,
} as const;

function persistRunning(state: TimerState): void {
  // Quick-start sessions have no category; normal sessions require both label and category.
  if (state.startedAt === null || state.taskLabel === null) return;
  if (!state.isQuickStart && state.category === null) return;
  const snapshot: PersistedTimer = {
    taskLabel: state.taskLabel,
    category: state.category,
    estimateMin: state.estimateMin,
    startedAt: state.startedAt,
    pausedAccumMs: state.pausedAccumMs,
    pausedAt: state.pausedAt,
    guessMin: state.guessMin,
    taskId: state.taskId,
    suggestedHonestMin: state.suggestedHonestMin,
    isQuickStart: state.isQuickStart,
  };
  try {
    kv.set(ACTIVE_TIMER_KEY, JSON.stringify(snapshot));
  } catch {
    // persistence is best-effort; never block the timer
  }
}

function clearPersisted(): void {
  try {
    kv.delete(ACTIVE_TIMER_KEY);
  } catch {
    // best-effort
  }
}

export const useTimerStore = create<TimerState>((set, get) => ({
  ...CLEARED,

  start: (task, nowMs = Date.now()) => {
    set({
      taskLabel: task.label,
      category: task.category,
      estimateMin: task.estimateMin,
      startedAt: nowMs,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: true,
      // Guess + honest default to the estimate when not passed (single-number flow).
      guessMin: task.guessMin ?? task.estimateMin,
      taskId: task.taskId ?? null,
      suggestedHonestMin: task.suggestedHonestMin ?? task.estimateMin,
      isQuickStart: false,
    });
    persistRunning(get());
  },

  quickStart: (nowMs = Date.now()) => {
    set({
      taskLabel: '',
      category: null,
      estimateMin: 0,
      startedAt: nowMs,
      pausedAccumMs: 0,
      pausedAt: null,
      isRunning: true,
      guessMin: 0,
      taskId: null,
      suggestedHonestMin: 0,
      isQuickStart: true,
    });
    persistRunning(get());
  },

  pause: (nowMs = Date.now()) => {
    const state = get();
    if (!state.isRunning || state.pausedAt !== null) return;
    set({ pausedAt: nowMs, isRunning: false });
    persistRunning(get());
  },

  resume: (nowMs = Date.now()) => {
    const state = get();
    if (state.pausedAt === null) return;
    set({
      pausedAccumMs: state.pausedAccumMs + (nowMs - state.pausedAt),
      pausedAt: null,
      isRunning: true,
    });
    persistRunning(get());
  },

  stop: (nowMs) => {
    const state = get();
    const startedAt = state.startedAt ?? nowMs;
    // If stopped while paused, fold the open paused span into the accumulator.
    const pausedAccum =
      state.pausedAt !== null ? state.pausedAccumMs + (nowMs - state.pausedAt) : state.pausedAccumMs;
    const activeMs = nowMs - startedAt - pausedAccum;
    const actualMin = Math.max(1, Math.round(activeMs / 60000));
    set({ ...CLEARED });
    clearPersisted();
    return { actualMin };
  },

  cancel: () => {
    set({ ...CLEARED });
    clearPersisted();
  },

  resumeFromKv: () => {
    const raw = kv.getString(ACTIVE_TIMER_KEY);
    if (raw === null) return;
    try {
      const p = JSON.parse(raw) as PersistedTimer;
      set({
        taskLabel: p.taskLabel,
        category: p.category,
        estimateMin: p.estimateMin,
        startedAt: p.startedAt,
        pausedAccumMs: p.pausedAccumMs,
        pausedAt: p.pausedAt,
        isRunning: p.pausedAt === null,
        // Fall back to estimate for snapshots written before these fields existed.
        guessMin: p.guessMin ?? p.estimateMin,
        taskId: p.taskId ?? null,
        suggestedHonestMin: p.suggestedHonestMin ?? p.estimateMin,
        // Default false for snapshots written before isQuickStart was introduced.
        isQuickStart: p.isQuickStart ?? false,
      });
    } catch {
      clearPersisted();
    }
  },
}));
