import { durationParts, formatDuration } from '../formatDuration';

const t = ((key: string, opts?: { count?: number }) => {
  const n = opts?.count ?? 0;
  if (key === 'duration.h') return `${n}h`;
  if (key === 'duration.m') return `${n}m`;
  return key;
}) as unknown as import('i18next').TFunction;

describe('formatDuration', () => {
  it('splits minutes into hours and minutes', () => {
    expect(durationParts(75)).toEqual({ h: 1, m: 15 });
    expect(durationParts(60)).toEqual({ h: 1, m: 0 });
    expect(durationParts(45)).toEqual({ h: 0, m: 45 });
  });

  it('formats via the injected translator (no hardcoded units)', () => {
    expect(formatDuration(75, t)).toBe('1h 15m');
    expect(formatDuration(60, t)).toBe('1h');
    expect(formatDuration(45, t)).toBe('45m');
    expect(formatDuration(0, t)).toBe('0m');
  });
});
