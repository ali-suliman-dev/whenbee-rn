import { canEditRow } from '@/src/features/today/canEditRow';

test('editable when no timer is running', () => {
  expect(canEditRow(false, null, 'a')).toBe(true);
});
test('editable when a DIFFERENT task is running', () => {
  expect(canEditRow(true, 'other', 'a')).toBe(true);
});
test('not editable when THIS task is the running timer', () => {
  expect(canEditRow(true, 'a', 'a')).toBe(false);
});
