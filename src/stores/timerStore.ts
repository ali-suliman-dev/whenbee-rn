import { create } from 'zustand';
import { kv } from '@/src/lib/kv';

const ACTIVE_TIMER_KEY = 'whenbee.activeTimer';

/** Persisted shape for crash-resume. Only a running timer is ever stored. */
interface PersistedTimer {
  taskLabel: string;
  category: string;
  estimateMin: number;
  startedAt: number;
  pausedAccumMs: number;
  pausedAt: number | null;
}

interface TimerState {
  taskLabel: string | null;
  category: string | null;
  estimateMin: number;
  startedAt: number | null;
  pausedAccumMs: number;
  pausedAt: number | null;
  isRunning: boolean;
  start: (task: { label: string; category: string; estimateMin: number }, nowMs?: number) => void;
  pause: (nowMs?: number) => void;
  resume: (nowMs?: number) => void;
  /** Returns ACTIVE minutes (excludes paused spans), min 1. Clears state + kv. */
  stop: (nowMs: number) => { actualMin: number };
  /** Abandon path — clears state + kv, returns nothing. */
  cancel: () => void;
  /** Rehydrate from kv if a timer was running (crash-resume). */
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
} as const;

function persistRunning(state: TimerState): void {
  if (state.startedAt === null || state.taskLabel === null || state.category === null) return;
  const snapshot: PersistedTimer = {
    taskLabel: state.taskLabel,
    category: state.category,
    estimateMin: state.estimateMin,
    startedAt: state.startedAt,
    pausedAccumMs: state.pausedAccumMs,
    pausedAt: state.pausedAt,
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
      });
    } catch {
      clearPersisted();
    }
  },
}));
