// Fixed "minutes ago you finished" offsets for the manual Forgot-to-stop sheet.
// A preset is only offered when its corrected actual is a real (≥1m) duration.
export interface ForgotPreset {
  /** How many minutes ago the user says they finished. */
  offsetMin: number;
  /** The actual minutes that offset would log = floor(elapsed) − offset. */
  actualMin: number;
}

const OFFSETS_MIN = [5, 15] as const;

export function buildForgotPresets(elapsedMin: number): ForgotPreset[] {
  const elapsed = Math.floor(elapsedMin);
  return OFFSETS_MIN
    .map((offsetMin) => ({ offsetMin, actualMin: elapsed - offsetMin }))
    .filter((p) => p.actualMin >= 1);
}
