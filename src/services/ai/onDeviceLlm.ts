// Vendor-neutral contract for the on-device LLM. Keeps feature code independent
// of which Apple Foundation Models bridge we ship, so the vendor can be swapped in
// a single adapter file. On-device only — there is intentionally no network path.

export type AiAvailability =
  | 'available'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'unavailable';

/** A single structured-output field. v1 only needs string fields. */
export interface LlmStructuredField {
  type: 'string';
  description: string;
}

export interface OnDeviceLlm {
  /** Current Apple Intelligence availability on this device. */
  availability: () => Promise<AiAvailability>;
  /**
   * Run one structured-output generation. Returns the validated object, or null
   * if the model is unavailable / errors — callers fall back to Tier-1.
   */
  structure: <T extends Record<string, string>>(args: {
    instructions: string;
    prompt: string;
    schema: { [K in keyof T]: LlmStructuredField };
  }) => Promise<T | null>;
}
