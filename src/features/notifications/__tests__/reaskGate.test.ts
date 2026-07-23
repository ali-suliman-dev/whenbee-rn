// TDD: reaskGate — the once-ever re-ask after a declined notification soft-ask.
//
// Design (2026-07-23, founder-approved "overrun receipt + piggyback"):
// a user who tapped "Not now" on the first-log soft-ask gets exactly ONE later
// re-ask, at a moment where the ping's value is self-evident:
//   • 'granted'  — OS permission was granted elsewhere (start-by nudge), so the
//                  finish ping is one tap away with no OS prompt. Wins over overrun.
//   • 'overrun'  — the log they just banked ran well past its guess.
// Guardrails: ≥5 logs and ≥3 days since the decline, never after an OS denial,
// never while reminders are already on, and never twice.

import {
  reaskTriggerFor,
  REASK_MIN_DAYS,
  REASK_MIN_LOGS,
  REASK_OVERRUN_RATIO,
  REASK_OVERRUN_MIN,
} from '../reaskGate';

const DAY = 24 * 60 * 60 * 1000;

/** Eligible-by-default input; tests override one dimension at a time. */
function base() {
  return {
    status: 'declined' as const,
    reaskUsed: false,
    remindersEnabled: false,
    permStatus: 'undetermined' as const,
    declinedAtMs: 0,
    nectarAtDecline: 1,
    lifetimeNectar: 6, // +5 logs since decline
    nowMs: 4 * DAY, // 4 days later
    guessMin: 30,
    actualMin: 60, // 2× over — clear overrun
  };
}

describe('reaskTriggerFor — hard gates', () => {
  it('null unless the soft-ask was declined', () => {
    expect(reaskTriggerFor({ ...base(), status: 'pending' })).toBeNull();
    expect(reaskTriggerFor({ ...base(), status: 'accepted' })).toBeNull();
  });

  it('null once the one-shot budget is spent', () => {
    expect(reaskTriggerFor({ ...base(), reaskUsed: true })).toBeNull();
  });

  it('null when reminders are already on', () => {
    expect(reaskTriggerFor({ ...base(), remindersEnabled: true })).toBeNull();
  });

  it('null after an OS-level denial — never fight the system prompt', () => {
    expect(reaskTriggerFor({ ...base(), permStatus: 'denied' })).toBeNull();
  });

  it('null before 3 days have passed since the decline', () => {
    expect(reaskTriggerFor({ ...base(), nowMs: 2 * DAY })).toBeNull();
    expect(reaskTriggerFor({ ...base(), nowMs: 3 * DAY })).not.toBeNull();
  });

  it('null before 5 more logs have been banked since the decline', () => {
    expect(reaskTriggerFor({ ...base(), lifetimeNectar: 5 })).toBeNull();
    expect(reaskTriggerFor({ ...base(), lifetimeNectar: 6 })).not.toBeNull();
  });
});

describe('reaskTriggerFor — trigger selection', () => {
  it("'granted' when OS permission already exists (start-by piggyback) — beats overrun", () => {
    expect(reaskTriggerFor({ ...base(), permStatus: 'granted' })).toBe('granted');
    // Even without an overrun, granted fires.
    expect(
      reaskTriggerFor({ ...base(), permStatus: 'granted', guessMin: 30, actualMin: 30 }),
    ).toBe('granted');
  });

  it("'overrun' when the banked log ran ≥1.4× or ≥10m past its guess", () => {
    expect(reaskTriggerFor({ ...base(), guessMin: 30, actualMin: 42 })).toBe('overrun'); // 1.4×
    expect(reaskTriggerFor({ ...base(), guessMin: 60, actualMin: 70 })).toBe('overrun'); // +10m
  });

  it('null when the log landed near its guess — no moment, no ask', () => {
    expect(reaskTriggerFor({ ...base(), guessMin: 30, actualMin: 33 })).toBeNull();
    expect(reaskTriggerFor({ ...base(), guessMin: 30, actualMin: 25 })).toBeNull(); // under
  });

  it('null for a zero/invalid guess', () => {
    expect(reaskTriggerFor({ ...base(), guessMin: 0, actualMin: 60 })).toBeNull();
  });

  it('guardrail constants are the approved values', () => {
    expect(REASK_MIN_DAYS).toBe(3);
    expect(REASK_MIN_LOGS).toBe(5);
    expect(REASK_OVERRUN_RATIO).toBe(1.4);
    expect(REASK_OVERRUN_MIN).toBe(10);
  });
});
