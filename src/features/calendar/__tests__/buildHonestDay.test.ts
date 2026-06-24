import { buildHonestDay, categoryForTitle } from '../buildHonestDay';
import type { CalendarEvent } from '@/src/services/calendar';

// Fixed clock so every assertion is deterministic — the engine is clock-free and
// the day bounds are passed in (no Date.now() inside buildHonestDay).
const DAY_START = new Date('2026-06-13T08:00:00').getTime();
const MIN = 60_000;
const at = (offsetMin: number) => DAY_START + offsetMin * MIN;

function event(id: string, title: string, startMin: number, endMin: number): CalendarEvent {
  return { id, title, startMs: at(startMin), endMs: at(endMin), allDay: false, calendarId: 'test-cal' };
}

describe('categoryForTitle', () => {
  it('maps known keywords to their category id', () => {
    expect(categoryForTitle('Morning standup call')).toBe('calls');
    expect(categoryForTitle('Reply to email')).toBe('email');
    expect(categoryForTitle('Drive / commute home')).toBe('commute');
    expect(categoryForTitle('Write the spec')).toBe('writing');
  });

  it('is case-insensitive', () => {
    expect(categoryForTitle('CLEANING the kitchen')).toBe('cleaning');
  });

  it('returns null when no keyword matches', () => {
    expect(categoryForTitle('Dentist appointment')).toBeNull();
    expect(categoryForTitle('')).toBeNull();
  });
});

describe('buildHonestDay', () => {
  const opts = (overrides?: Partial<Parameters<typeof buildHonestDay>[2]>) => ({
    nowMs: DAY_START,
    dayEndMs: at(14 * 60), // 10:00pm
    defaultMultiplier: 1.8,
    ...overrides,
  });

  it('inflates a block by its category multiplier (M=2 doubles a 30-min block)', () => {
    const events = [event('e1', 'Write report', 0, 30)];
    const stats = { writing: { mEffective: 2 } };

    const { before, after } = buildHonestDay(events, stats, opts());

    const beforeBlock = before[0];
    const afterBlock = after[0];
    expect(beforeBlock).toBeDefined();
    expect(afterBlock).toBeDefined();
    if (!beforeBlock || !afterBlock) return;
    // Planned: 30 min. Honest: 30 × 2 = 60 min.
    expect(beforeBlock.durationMin).toBe(30);
    expect(afterBlock.durationMin).toBe(60);
    // First block keeps its original start.
    expect(afterBlock.startMs).toBe(at(0));
    expect(afterBlock.endMs).toBe(at(60));
  });

  it('falls back to the default multiplier for an unrecognized title', () => {
    const events = [event('e1', 'Dentist appointment', 0, 60)];
    const { after } = buildHonestDay(events, {}, opts({ defaultMultiplier: 1.5 }));

    const block = after[0];
    expect(block).toBeDefined();
    if (!block) return;
    expect(block.categoryId).toBeNull();
    expect(block.durationMin).toBe(90); // 60 × 1.5
  });

  it('uses the prior (default) multiplier when a category has no learned stat', () => {
    const events = [event('e1', 'Cleaning the house', 0, 60)];
    // 'cleaning' maps but has no stat → falls back to defaultMultiplier.
    const { after } = buildHonestDay(events, {}, opts({ defaultMultiplier: 1.8 }));

    const block = after[0];
    expect(block).toBeDefined();
    if (!block) return;
    expect(block.categoryId).toBe('cleaning');
    expect(block.durationMin).toBe(108); // 60 × 1.8
  });

  it('cascades later events forward and computes the day-end shift', () => {
    // 9:00 write (30m, M=2 → 60m), 10:00 call (30m, M=1 → 30m back-to-back).
    const events = [
      event('e1', 'Write report', 60, 90), // 9:00–9:30
      event('e2', 'Client call', 120, 150), // 10:00–10:30
    ];
    const stats = { writing: { mEffective: 2 }, calls: { mEffective: 1 } };

    const result = buildHonestDay(events, stats, opts());

    const [a1, a2] = result.after;
    expect(a1).toBeDefined();
    expect(a2).toBeDefined();
    if (!a1 || !a2) return;
    // Write inflates 30→60 → ends 10:00 (at(120)).
    expect(a1.endMs).toBe(at(120));
    // Call is pushed to start where write now ends (10:00), not its original 10:00
    // — here they coincide. It runs 30m (M=1) → ends 10:30 (at(150)).
    expect(a2.startMs).toBe(at(120));
    expect(a2.endMs).toBe(at(150));

    // dayEnd* are minutes from local midnight. DAY_START is 08:00 (480 min), so
    // a 10:30 end is 480 + 150 = 630. The writing overrun exactly consumed the
    // gap to the call → planned and honest day both end 10:30 → 0 shift.
    expect(result.dayEndBeforeMin).toBe(630);
    expect(result.dayEndAfterMin).toBe(630);
  });

  it('pushes a later event when an earlier overrun would overlap it', () => {
    // 9:00 write (60m, M=2 → 120m → ends 11:00) collides with 10:00 call.
    const events = [
      event('e1', 'Write report', 60, 120), // 9:00–10:00
      event('e2', 'Client call', 120, 150), // 10:00–10:30
    ];
    const stats = { writing: { mEffective: 2 }, calls: { mEffective: 1 } };

    const { after, dayEndBeforeMin, dayEndAfterMin } = buildHonestDay(events, stats, opts());

    const [, a2] = after;
    expect(a2).toBeDefined();
    if (!a2) return;
    // Write now ends 11:00 (at(180)); the call is pushed to start there.
    expect(a2.startMs).toBe(at(180));
    expect(a2.endMs).toBe(at(210)); // 11:00 + 30m

    // Minutes from midnight (08:00 = 480). Planned ended 10:30 = 630; honest
    // ends 11:30 = 690 → a 60-min shift.
    expect(dayEndBeforeMin).toBe(630);
    expect(dayEndAfterMin).toBe(690);
  });

  it('preserves a real gap between events (does not pull the second one earlier)', () => {
    const events = [
      event('e1', 'Client call', 0, 30), // 8:00–8:30, M=1 → unchanged
      event('e2', 'Cleaning', 120, 150), // 10:00–10:30, gap stays
    ];
    const stats = { calls: { mEffective: 1 }, cleaning: { mEffective: 1 } };

    const { after } = buildHonestDay(events, stats, opts());
    const [, a2] = after;
    expect(a2).toBeDefined();
    if (!a2) return;
    // No overrun upstream → the 10:00 start is preserved (gap intact).
    expect(a2.startMs).toBe(at(120));
  });

  it('flags overflowsDay when the honest day runs past the day-end bound', () => {
    // One huge block whose honest length blows past the 10:00pm bound.
    const events = [event('e1', 'Write the novel', 0, 300)]; // 5h planned
    const stats = { writing: { mEffective: 3 } }; // → 15h honest

    const result = buildHonestDay(events, stats, opts({ dayEndMs: at(14 * 60) }));

    expect(result.overflowsDay).toBe(true);
    expect(result.dayEndAfterMin).toBeGreaterThan(14 * 60);
  });

  it('does not flag overflow when the honest day still fits', () => {
    const events = [event('e1', 'Client call', 0, 30)];
    const stats = { calls: { mEffective: 1 } };

    const result = buildHonestDay(events, stats, opts());
    expect(result.overflowsDay).toBe(false);
  });

  it('returns empty results and no overflow for an empty day', () => {
    const result = buildHonestDay([], {}, opts());
    expect(result.before).toEqual([]);
    expect(result.after).toEqual([]);
    expect(result.overflowsDay).toBe(false);
    expect(result.dayEndAfterMin).toBeNull();
    expect(result.dayEndBeforeMin).toBeNull();
  });

  it('is pure — does not mutate its inputs', () => {
    const events = [event('e1', 'Write report', 0, 30)];
    const frozen = Object.freeze(events.map((e) => Object.freeze({ ...e })));
    const stats = Object.freeze({ writing: Object.freeze({ mEffective: 2 }) });
    expect(() => buildHonestDay(frozen as CalendarEvent[], stats, opts())).not.toThrow();
  });
});
