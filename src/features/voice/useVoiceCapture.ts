// Orchestrates one voice capture: resolve locale + capability → on-device STT
// (or, only with explicit per-locale consent, network STT) → live partials →
// structure the final transcript into a draft. The single place tiering lives;
// Tier-2 (Apple LLM) is layered in at Task 12 via structureSpokenTask(). Until
// then it structures with the pure Tier-1 parser.

import { useCallback, useRef, useState } from 'react';
import i18n from '@/src/i18n';
import type { ParsedTaskDraft } from '@/src/domain/types';
import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';
import { appLangToSttLocale } from './localeToStt';
import { resolveRecognitionCapability } from '@/src/services/voice/recognitionCapability';
import { hasNetworkSttConsent, grantNetworkSttConsent } from '@/src/services/voice/networkSttConsent';
import {
  requestSpeechPermission,
  startSpeech,
  downloadOfflineModel,
  type SpeechSession,
} from '@/src/services/voice/speechRecognition';

export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'unavailable'
  | 'denied'
  | 'needsDownload'
  | 'needsNetworkConsent';

export interface VoiceCapture {
  status: VoiceStatus;
  partial: string;
  start: () => Promise<void>;
  stop: () => void;
  /** Grants network-STT consent for the current locale, then retries start(). */
  confirmNetworkConsent: () => Promise<void>;
  /** Triggers the Android offline-model download for the current locale, then retries start(). */
  triggerDownload: () => Promise<void>;
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
    const sttLocale = appLangToSttLocale(i18n.language);
    const cap = await resolveRecognitionCapability(sttLocale);
    if (cap.platform === 'unsupported') {
      setStatus('unavailable');
      return;
    }

    let requiresOnDevice = cap.onDeviceAvailable;
    if (!cap.onDeviceAvailable) {
      if (cap.canDownloadModel) {
        setStatus('needsDownload');
        return; // UI offers the download; retry happens via triggerDownload()
      }
      if (!hasNetworkSttConsent(sttLocale)) {
        setStatus('needsNetworkConsent');
        return; // UI shows the consent sheet; retry happens via confirmNetworkConsent()
      }
      requiresOnDevice = false; // consented network fallback
    }

    const granted = await requestSpeechPermission();
    if (!granted) {
      setStatus('denied');
      return;
    }
    setPartial('');
    setStatus('listening');
    sessionRef.current = startSpeech(
      {
        onPartial: setPartial,
        onFinal: (text) => {
          sessionRef.current?.stop();
          sessionRef.current = null;
          setPartial('');
          setStatus('idle');
          // TODO(B3): pass i18n.language once structureSpokenTask is localized
          void structureSpokenTask(text).then((draft) => {
            if (draft.title.length > 0) onDraft(draft);
          });
        },
        onError: () => stop(),
        onEnd: () => {
          if (sessionRef.current) stop();
        },
      },
      { lang: sttLocale, requiresOnDevice },
    );
  }, [onDraft, stop]);

  const confirmNetworkConsent = useCallback(async () => {
    const sttLocale = appLangToSttLocale(i18n.language);
    grantNetworkSttConsent(sttLocale);
    await start();
  }, [start]);

  const triggerDownload = useCallback(async () => {
    const sttLocale = appLangToSttLocale(i18n.language);
    await downloadOfflineModel(sttLocale);
    await start();
  }, [start]);

  return { status, partial, start, stop, confirmNetworkConsent, triggerDownload };
};
