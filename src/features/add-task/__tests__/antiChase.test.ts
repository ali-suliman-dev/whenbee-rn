import { shouldShowAntiChase } from '@/src/features/add-task/antiChase';

describe('shouldShowAntiChase', () => {
  it('fires when the guess is raised to the honest number', () => {
    expect(
      shouldShowAntiChase({ prevGuess: 15, nextGuess: 30, honestMinutes: 30, seen: false }),
    ).toBe(true);
  });

  it('fires when the guess is raised past the honest number', () => {
    expect(
      shouldShowAntiChase({ prevGuess: 20, nextGuess: 45, honestMinutes: 30, seen: false }),
    ).toBe(true);
  });

  it('stays quiet while the raised guess is still below the honest number', () => {
    expect(
      shouldShowAntiChase({ prevGuess: 15, nextGuess: 25, honestMinutes: 30, seen: false }),
    ).toBe(false);
  });

  it('stays quiet when the guess is lowered', () => {
    expect(
      shouldShowAntiChase({ prevGuess: 40, nextGuess: 30, honestMinutes: 30, seen: false }),
    ).toBe(false);
  });

  it('never fires again once seen', () => {
    expect(
      shouldShowAntiChase({ prevGuess: 15, nextGuess: 30, honestMinutes: 30, seen: true }),
    ).toBe(false);
  });
});
