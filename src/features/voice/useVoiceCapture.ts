// Orchestrates one voice capture: permission → on-device STT → live partials →
// structure the final transcript into a draft. The single place tiering lives;
// Tier-2 (Apple LLM) is layered in at Task 12 via structureSpokenTask(). Until
// then it structures with the pure Tier-1 parser.

import { useCallback, useRef, useState } from 'react';
import type { ParsedTaskDraft } from '@/src/domain/types';
import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';
import {
  requestSpeechPermission,
  startSpeech,
  supportsOnDeviceSpeech,
  type SpeechSession,
} from '@/src/services/voice/speechRecognition';

export type VoiceStatus = 'idle' | 'listening' | 'unavailable' | 'denied';

export interface VoiceCapture {
  status: VoiceStatus;
  partial: string;
  start: () => Promise<void>;
  stop: () => void;
}

export const useVoiceCapture = (onDraft: (d: ParsedTaskDraft) => void): VoiceCapture => {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [partial, setPartial] = useState('');
  const sessionRef = useRef<SpeechSession | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPartial('');
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!supportsOnDeviceSpeech()) {
      setStatus('unavailable');
      return;
    }
    const granted = await requestSpeechPermission();
    if (!granted) {
      setStatus('denied');
      return;
    }
    setPartial('');
    setStatus('listening');
    // TODO(B2): resolve capability + locale
    sessionRef.current = startSpeech(
      {
        onPartial: setPartial,
        onFinal: (text) => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          setPartial('');
          setStatus('idle');
          void structureSpokenTask(text).then((draft) => {
            if (draft.title.length > 0) onDraft(draft);
          });
        },
        onError: () => stop(),
        onEnd: () => {
          if (sessionRef.current) stop();
        },
      },
      { lang: 'en-US', requiresOnDevice: true },
    );
  }, [onDraft, stop]);

  return { status, partial, start, stop };
};
