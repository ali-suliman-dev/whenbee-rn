// src/features/today/__tests__/dayRecapCopy.test.ts
// TDD for the pure recap copy module — headline wording and gap-bar labels.

import { recapHeadline, recapScale } from '@/src/features/today/dayRecapCopy';

describe('recapHeadline', () => {
  it('words an over day without a plus sign', () => {
    expect(recapHeadline({ doneCount: 4, vsGuessMin: 35 })).toEqual({
      lead: 'Ran ', gap: '35m over', trail: ' the day you pictured.', direction: 'over',
    });
  });

  it('words an under day', () => {
    expect(recapHeadline({ doneCount: 3, vsGuessMin: -20 })).toEqual({
      lead: 'Came in ', gap: '20m under', trail: ' the day you pictured.', direction: 'under',
    });
  });

  it('has no gap span when the day landed even', () => {
    expect(recapHeadline({ doneCount: 2, vsGuessMin: 0 })).toEqual({
      lead: 'Landed right on the day you pictured.', gap: null, trail: '', direction: 'even',
    });
  });

  it('reports an empty day with no gap span', () => {
    expect(recapHeadline({ doneCount: 0, vsGuessMin: 0 })).toEqual({
      lead: 'Nothing logged that day.', gap: null, trail: '', direction: 'empty',
    });
  });

  it('crosses the hour boundary', () => {
    expect(recapHeadline({ doneCount: 5, vsGuessMin: 65 }).gap).toBe('1h 5m over');
  });
});

describe('recapScale', () => {
  it('labels both ends of the gap bar', () => {
    expect(recapScale(130, 165)).toEqual({ left: 'guessed 2h 10m', right: 'real 2h 45m' });
  });
});
