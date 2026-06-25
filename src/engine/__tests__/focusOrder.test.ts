import { orderForFocus } from '../focusOrder';

// Generic task shape for tests
interface Task {
  id: string;
  deep: boolean;
}

const t = (id: string, deep: boolean): Task => ({ id, deep });
const isDeep = (task: Task): boolean => task.deep;

const WINDOW = { focusWindowStartMin: 540, focusWindowEndMin: 720 } as const; // 09:00–12:00
const NO_WINDOW_START = { focusWindowStartMin: null, focusWindowEndMin: 720 } as const;
const NO_WINDOW_END = { focusWindowStartMin: 540, focusWindowEndMin: null } as const;
const NULL_WINDOW = { focusWindowStartMin: null, focusWindowEndMin: null } as const;

describe('orderForFocus', () => {
  it('returns [] for empty input', () => {
    expect(orderForFocus([], { ...WINDOW, isDeep })).toEqual([]);
  });

  it('with focus window: deep tasks come before light tasks', () => {
    const input = [t('L1', false), t('D1', true), t('L2', false), t('D2', true)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['D1', 'D2', 'L1', 'L2']);
  });

  it('with focus window: deep tasks preserve their original relative order', () => {
    const input = [t('D2', true), t('D1', true), t('D3', true)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['D2', 'D1', 'D3']);
  });

  it('with focus window: light tasks preserve their original relative order', () => {
    const input = [t('L2', false), t('L1', false), t('L3', false)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['L2', 'L1', 'L3']);
  });

  it('with focus window: stability across mixed input [L1,D1,L2,D2] → [D1,D2,L1,L2]', () => {
    const input = [t('L1', false), t('D1', true), t('L2', false), t('D2', true)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['D1', 'D2', 'L1', 'L2']);
  });

  it('null focusWindowStartMin → identity order (no reorder)', () => {
    const input = [t('L1', false), t('D1', true), t('L2', false), t('D2', true)];
    const result = orderForFocus(input, { ...NO_WINDOW_START, isDeep });
    expect(result.map((x) => x.id)).toEqual(['L1', 'D1', 'L2', 'D2']);
  });

  it('null focusWindowEndMin → identity order (no reorder)', () => {
    const input = [t('L1', false), t('D1', true), t('L2', false), t('D2', true)];
    const result = orderForFocus(input, { ...NO_WINDOW_END, isDeep });
    expect(result.map((x) => x.id)).toEqual(['L1', 'D1', 'L2', 'D2']);
  });

  it('both bounds null → identity order (no reorder)', () => {
    const input = [t('D1', true), t('L1', false), t('D2', true)];
    const result = orderForFocus(input, { ...NULL_WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['D1', 'L1', 'D2']);
  });

  it('all deep tasks with focus window → order unchanged', () => {
    const input = [t('D1', true), t('D2', true), t('D3', true)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['D1', 'D2', 'D3']);
  });

  it('all light tasks with focus window → order unchanged', () => {
    const input = [t('L1', false), t('L2', false), t('L3', false)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result.map((x) => x.id)).toEqual(['L1', 'L2', 'L3']);
  });

  it('does not mutate the input array', () => {
    const input = [t('L1', false), t('D1', true)];
    const copy = [...input];
    orderForFocus(input, { ...WINDOW, isDeep });
    expect(input).toEqual(copy);
  });

  it('returns a new array (not the same reference)', () => {
    const input = [t('L1', false), t('D1', true)];
    const result = orderForFocus(input, { ...WINDOW, isDeep });
    expect(result).not.toBe(input);
  });

  it('works generically with number tasks', () => {
    const nums = [1, 2, 3, 4, 5];
    const result = orderForFocus(nums, {
      focusWindowStartMin: 0,
      focusWindowEndMin: 60,
      isDeep: (n) => n % 2 === 0, // even numbers are "deep"
    });
    // deep: [2,4], light: [1,3,5]
    expect(result).toEqual([2, 4, 1, 3, 5]);
  });
});
