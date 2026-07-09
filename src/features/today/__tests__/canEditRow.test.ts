import { canEditRow } from '@/src/features/today/canEditRow';

test('editable when no timer is running', () => {
  expect(canEditRow(false, null, 'a', false)).toBe(true);
});
test('editable when a DIFFERENT task is running', () => {
  expect(canEditRow(true, 'other', 'a', false)).toBe(true);
});
test('not editable when THIS task is the running timer', () => {
  expect(canEditRow(true, 'a', 'a', false)).toBe(false);
});
test('not editable when the row is done', () => {
  expect(canEditRow(false, null, 'a', true)).toBe(false);
});
