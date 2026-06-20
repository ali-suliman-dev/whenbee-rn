// Tier-2 structuring: ask the on-device Apple model to rewrite a spoken ramble
// into a short imperative task. On any non-availability, error, or empty result,
// fall back to the pure Tier-1 parser. Category + honest estimate are NOT asked
// for here — the field's onChangeText cascade derives them from the title.

import type { ParsedTaskDraft } from '@/src/domain/types';
import { getOnDeviceLlm } from '@/src/services/ai';
import { parseSpokenTask } from '@/src/features/voice/parsing/spokenTaskParser';

const INSTRUCTIONS =
  'Rewrite the user’s spoken note into a single short task. Start with a verb, ' +
  'imperative mood, at most 6 words, no preamble or filler. Return only the task title.';

export const structureSpokenTask = async (transcript: string): Promise<ParsedTaskDraft> => {
  const llmResult = await getOnDeviceLlm().structure<{ title: string }>({
    instructions: INSTRUCTIONS,
    prompt: transcript,
    schema: { title: { type: 'string', description: 'The rewritten imperative task title' } },
  });

  const llmTitle = llmResult?.title?.trim() ?? '';
  if (llmTitle.length > 0) {
    return { title: llmTitle, rawTranscript: transcript, source: 'appleLLM' };
  }
  return parseSpokenTask(transcript); // Tier-1 fallback (source: 'rules')
};
