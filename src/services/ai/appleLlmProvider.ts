// Adapter: react-native-apple-llm (Apple Foundation Models, on-device) → our
// OnDeviceLlm contract. THE ONLY FILE that imports the vendor package. Guards
// Expo Go and any device without Apple Intelligence, returning 'unavailable' /
// null so callers fall back to Tier-1 rules.
//
// Vendor API (react-native-apple-llm / deveix):
//   isFoundationModelsEnabled() → Promise<FoundationModelsAvailability>
//   AppleLLMSession.configure({ instructions? }) → Promise<boolean>
//   AppleLLMSession.generateStructuredOutput({ structure: StructureSchema, prompt }) → Promise<any>
//   AppleLLMSession.dispose() → void

import { isExpoGo } from '@/src/lib/isExpoGo';
import {
  AppleLLMSession,
  isFoundationModelsEnabled,
} from 'react-native-apple-llm';
import type { StructureSchema } from 'react-native-apple-llm';
import type { AiAvailability, LlmStructuredField, OnDeviceLlm } from './onDeviceLlm';

const availability = async (): Promise<AiAvailability> => {
  if (isExpoGo) return 'unavailable';
  try {
    // FoundationModelsAvailability union is identical to AiAvailability; safe cast.
    return (await isFoundationModelsEnabled()) as AiAvailability;
  } catch {
    return 'unavailable';
  }
};

// The generic <T> threaded through OnDeviceLlm['structure'] means we cannot
// annotate the function directly with that type (TS widens the return to
// Record<string,string>). Implement as a typed generic function and cast only
// the final object result — a single documented-shape boundary cast where the
// vendor returns `any`.
async function structure<T extends Record<string, string>>(args: {
  instructions: string;
  prompt: string;
  schema: { [K in keyof T]: LlmStructuredField };
}): Promise<T | null> {
  if ((await availability()) !== 'available') return null;

  // Map our schema (Record<key, LlmStructuredField>) → vendor StructureSchema.
  // LlmStructuredField = { type: 'string'; description: string } is a strict subset of
  // StructureProperty = { type?: ...; description?: string; ... } — fully compatible.
  const vendorStructure: StructureSchema = args.schema as Record<string, LlmStructuredField>;

  const session = new AppleLLMSession();
  try {
    await session.configure({ instructions: args.instructions });
    // generateStructuredOutput returns `any`; cast to T at the documented-shape boundary.
    const result: T | null | undefined = await session.generateStructuredOutput({
      structure: vendorStructure,
      prompt: args.prompt,
    }) as T | null | undefined;
    return result ?? null;
  } catch {
    return null;
  } finally {
    session.dispose();
  }
}

export const appleLlmProvider: OnDeviceLlm = { availability, structure };
