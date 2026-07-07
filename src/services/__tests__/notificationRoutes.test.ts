import { buildStartByTimerRoute } from '@/src/services/notificationRoutes';

test('builds a timer deep link from an enriched startBy payload', () => {
  const route = buildStartByTimerRoute({
    kind: 'startBy',
    taskId: 't1',
    firstTaskLabel: 'Deep work',
    category: 'deep_work',
    guessMin: 30,
    honestMin: 45,
  });
  expect(route).toBe(
    '/(modals)/timer?taskId=t1&label=Deep%20work&category=deep_work&estimateMin=45&guessMin=30',
  );
});

test('omits taskId when the payload has none', () => {
  const route = buildStartByTimerRoute({
    kind: 'startBy', firstTaskLabel: 'Deep work', category: 'deep_work', guessMin: 30, honestMin: 45,
  });
  expect(route).toBe('/(modals)/timer?label=Deep%20work&category=deep_work&estimateMin=45&guessMin=30');
});

test('returns null when the honest estimate is missing (cannot start a timer)', () => {
  const route = buildStartByTimerRoute({ kind: 'startBy', firstTaskLabel: 'Deep work' });
  expect(route).toBeNull();
});
