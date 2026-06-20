// Single accessor so feature code never names a concrete provider. Swap the
// import here (and the adapter file) to change vendors with no downstream edits.
import { appleLlmProvider } from './appleLlmProvider';
import type { OnDeviceLlm } from './onDeviceLlm';

export const getOnDeviceLlm = (): OnDeviceLlm => appleLlmProvider;

export type { AiAvailability, LlmStructuredField, OnDeviceLlm } from './onDeviceLlm';
