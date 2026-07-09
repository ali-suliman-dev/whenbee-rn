// A row is editable only when it is NOT done and NOT the task whose timer is
// currently running (editing a live session's guess is ambiguous; a completed
// row's actual already trained the model — editing it must never re-log).
export function canEditRow(
  isTimerRunning: boolean,
  runningTaskId: string | null,
  rowId: string,
  isDone: boolean,
): boolean {
  return !isDone && !(isTimerRunning && runningTaskId === rowId);
}
