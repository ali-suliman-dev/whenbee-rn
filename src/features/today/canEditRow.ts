// A queued row is editable unless it is the task whose timer is currently running
// (editing a live session's guess is ambiguous — Move/Remove stay available).
export function canEditRow(
  isTimerRunning: boolean,
  runningTaskId: string | null,
  rowId: string,
): boolean {
  return !(isTimerRunning && runningTaskId === rowId);
}
