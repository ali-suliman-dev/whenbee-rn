// Pure route builder for notification actions. No expo-router / expo-notifications
// import so it is trivially unit-testable; notificationSetup consumes it.

/**
 * Build the timer-modal deep link that STARTS the first planned task from a
 * START_BY reminder. Returns null when the payload lacks the honest estimate
 * needed to run a timer — the caller then falls back to opening Today.
 */
export function buildStartByTimerRoute(data: Record<string, unknown>): string | null {
  const honestMin = Number(data.honestMin);
  if (!Number.isFinite(honestMin) || honestMin <= 0) return null;

  const label = typeof data.firstTaskLabel === 'string' ? data.firstTaskLabel : 'Focus session';
  const category = typeof data.category === 'string' ? data.category : 'getting_ready';
  const guessMin = Number.isFinite(Number(data.guessMin)) ? Number(data.guessMin) : honestMin;
  const taskId = typeof data.taskId === 'string' && data.taskId.length > 0 ? data.taskId : null;

  const parts: string[] = [];
  if (taskId) parts.push(`taskId=${encodeURIComponent(taskId)}`);
  parts.push(`label=${encodeURIComponent(label)}`);
  parts.push(`category=${encodeURIComponent(category)}`);
  parts.push(`estimateMin=${Math.round(honestMin)}`);
  parts.push(`guessMin=${Math.round(guessMin)}`);
  return `/(modals)/timer?${parts.join('&')}`;
}
