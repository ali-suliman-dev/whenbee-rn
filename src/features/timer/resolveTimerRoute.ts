// ──────────────────────────────────────────────────────────────────────────────
// resolveTimerRoute — the attach-vs-fresh contract for the Timer modal, pure.
//
// The timer route is opened from many places with very different amounts of
// context: in-app starters pass the full session params; the presence
// notification's body tap and the quick-task chips pass NOTHING; the home-screen
// widget passes only a taskId. The store is the source of truth for a RUNNING
// session — route params only ever describe a session to START. Deciding which
// one wins here (instead of inside the screen) is what stops a bare deep link
// from silently overwriting a running timer with placeholder params, which reset
// the clock and trained calibration on the wrong category (the presence-tap bug).
//
// Rules, in order:
//   1. Running quick-start session + no explicit task params → attach as quick.
//   2. Running session + (no explicit params, OR params describe the SAME task)
//      → attach, with the session context read from the STORE (never defaults).
//   3. Running session (quick or not) + explicit params for a DIFFERENT task →
//      confirm-switch. The running session won't log if the user proceeds, so
//      this is a destructive action — surface it for confirmation instead of
//      silently swapping (a quick session has no task identity of its own, so
//      ANY explicit start while one runs counts as a different task).
//   4. Running session + an explicit `replace=1` intent (a start path that
//      mutates the store BEFORE navigating, e.g. the tab-bar FAB, would clobber
//      a live session if it wrote first — routing through here with the intent
//      as a param instead lets the running session win until confirmed) →
//      confirm-switch, regardless of whether params also describe the same task.
//   5. Nothing running + no explicit params + not a quick nav → nothing to show;
//      send the user to Today instead of fabricating a placeholder session.
//   6. Otherwise → fresh session from the route params.
// ──────────────────────────────────────────────────────────────────────────────

export interface TimerRouteParams {
  taskId?: string | string[];
  label?: string | string[];
  category?: string | string[];
  estimateMin?: string | string[];
  guessMin?: string | string[];
  suggestedHonestMin?: string | string[];
  quick?: string | string[];
  /** Explicit "confirm before replacing the running session" intent — set by
   *  start paths that would otherwise mutate the timer store before this
   *  route even runs (see rule 4 above). */
  replace?: string | string[];
}

/** The slice of timer-store state the decision needs (structurally satisfied by
 *  the real store's getState()). */
export interface TimerStoreSnapshot {
  isRunning: boolean;
  startedAt: number | null;
  isQuickStart: boolean;
  taskId: string | null;
  taskLabel: string | null;
  category: string | null;
  estimateMin: number;
  guessMin: number;
  suggestedHonestMin: number;
}

/** Fully-resolved session the Timer screen mounts with. */
export interface TimerSessionParams {
  taskId?: string;
  label: string;
  category: string;
  estimateMin: number;
  guessMin: number;
  suggestedHonestMin: number;
  isQuickNav: boolean;
}

export type ResolvedTimerRoute =
  | { kind: 'session'; session: TimerSessionParams }
  | { kind: 'confirm-switch'; leavingLabel: string; startingLabel: string; session: TimerSessionParams }
  | { kind: 'redirect-today' };

const FALLBACK_LABEL = 'Focus session';
const FALLBACK_CATEGORY = 'getting_ready';
const FALLBACK_ESTIMATE_MIN = 15;
// A running quick session carries no label of its own (captured at stop) — this
// stands in for "the thing currently running" in the confirm-switch copy.
const RUNNING_FALLBACK_LABEL = 'your timer';
// The FAB quick-start's confirm-switch copy needs a starting label when no
// explicit label param is given (quick=1 with no task identity).
const QUICK_START_LABEL = 'a quick timer';

function first(v: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  return raw != null && raw.length > 0 ? raw : undefined;
}

function firstNum(v: string | string[] | undefined, fallback: number): number {
  const raw = first(v);
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function sessionFromParams(params: TimerRouteParams): TimerSessionParams {
  const estimateMin = firstNum(params.estimateMin, FALLBACK_ESTIMATE_MIN);
  return {
    taskId: first(params.taskId),
    label: first(params.label) ?? FALLBACK_LABEL,
    category: first(params.category) ?? FALLBACK_CATEGORY,
    estimateMin,
    // guessMin drives calibration; falls back to the honest estimate. The honest
    // number the user SAW defaults to estimateMin (which IS the honest number
    // when Today/Add-Task didn't pass it separately).
    guessMin: firstNum(params.guessMin, estimateMin),
    suggestedHonestMin: firstNum(params.suggestedHonestMin, estimateMin),
    isQuickNav: first(params.quick) === '1',
  };
}

function sessionFromStore(store: TimerStoreSnapshot): TimerSessionParams {
  return {
    taskId: store.taskId ?? undefined,
    label: store.taskLabel ?? FALLBACK_LABEL,
    category: store.category ?? FALLBACK_CATEGORY,
    estimateMin: store.estimateMin,
    guessMin: store.guessMin,
    suggestedHonestMin: store.suggestedHonestMin,
    isQuickNav: false,
  };
}

export function resolveTimerRoute(
  params: TimerRouteParams,
  store: TimerStoreSnapshot,
): ResolvedTimerRoute {
  const taskId = first(params.taskId);
  const label = first(params.label);
  const hasExplicitSession = taskId !== undefined || label !== undefined;
  const isRunning = store.isRunning && store.startedAt !== null;

  if (isRunning) {
    if (first(params.replace) === '1') {
      // Explicit replace intent (the FAB quick-start) — always confirm before
      // clobbering a live session, regardless of task identity. quickStart()
      // initializes taskLabel to '' (empty, not null), so leavingLabel MUST use
      // `||` — `??` would leave the sheet copy blank instead of falling back.
      return {
        kind: 'confirm-switch',
        leavingLabel: store.taskLabel || RUNNING_FALLBACK_LABEL,
        startingLabel: first(params.label) ?? QUICK_START_LABEL,
        session: sessionFromParams(params),
      };
    }
    if (store.isQuickStart) {
      // A quick=1 nav is a REOPEN of the running quick session — the minimized-timer
      // bar and RunningFocusCard reopen with a synthetic label ('Timing now'), and
      // presence/notification taps carry no params. Attach, never replace. Only a
      // real different-task start (explicit taskId/label WITHOUT quick=1) replaces a
      // quick session; the explicit FAB replace intent was handled above.
      if (first(params.quick) === '1' || !hasExplicitSession) {
        // Attach to the running quick session with the quick defaults (a quick
        // session carries no label/estimate of its own — capture happens at stop).
        return { kind: 'session', session: { ...sessionFromParams(params), isQuickNav: true } };
      }
      // A quick session has no task identity to compare against — any explicit
      // start while it's running is a replace.
      const session = sessionFromParams(params);
      return {
        kind: 'confirm-switch',
        leavingLabel: store.taskLabel || RUNNING_FALLBACK_LABEL,
        startingLabel: session.label,
        session,
      };
    }
    const sameTask =
      taskId !== undefined
        ? store.taskId === taskId
        : label !== undefined
          ? store.taskLabel === label
          : true;
    if (!hasExplicitSession || sameTask) {
      return { kind: 'session', session: sessionFromStore(store) };
    }
    const session = sessionFromParams(params);
    return {
      kind: 'confirm-switch',
      leavingLabel: store.taskLabel || RUNNING_FALLBACK_LABEL,
      startingLabel: session.label,
      session,
    };
  }

  if (!hasExplicitSession && first(params.quick) !== '1') return { kind: 'redirect-today' };
  return { kind: 'session', session: sessionFromParams(params) };
}
