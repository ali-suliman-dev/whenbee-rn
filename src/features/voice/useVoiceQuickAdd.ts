// Trio mic quick-add: record on its own, then hand the transcript to Add-Task.
//
// The arc's mic bubble drives this — listening lives in a standalone
// ListeningSheet with nothing behind it, so the recording IS the moment (not a
// half-open task drawer that auto-records). Only a non-empty transcript opens
// Add-Task, title pre-filled, so the user lands one field from done (minutes).
// Reuses the one useVoiceCapture orchestration so the field mic and the trio mic
// share a single recording path.

import { router } from 'expo-router';
import { useVoiceCapture, type VoiceCapture } from '@/src/features/voice/useVoiceCapture';
import type { ParsedTaskDraft } from '@/src/domain/types';

export const useVoiceQuickAdd = (): VoiceCapture =>
  useVoiceCapture((draft: ParsedTaskDraft) => {
    router.push({ pathname: '/(modals)/add-task', params: { title: draft.title } });
  });
