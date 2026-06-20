// On-device speech-to-text wrapper. Forces local recognition so audio never
// leaves the phone (core-loop invariant). Guards Expo Go (native module absent)
// and degrades to a no-op session so callers never crash.

import { isExpoGo } from '@/src/lib/isExpoGo';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

export interface SpeechHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

const NOOP_SESSION: SpeechSession = { stop: () => {} };

export const supportsOnDeviceSpeech = (): boolean => {
  if (isExpoGo) return false;
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
};

export const requestSpeechPermission = async (): Promise<boolean> => {
  if (isExpoGo) return false;
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
};

export const startSpeech = (handlers: SpeechHandlers): SpeechSession => {
  if (isExpoGo) {
    handlers.onError('expo-go-unsupported');
    return NOOP_SESSION;
  }

  const subs = [
    ExpoSpeechRecognitionModule.addListener(
      'result',
      (e: ExpoSpeechRecognitionResultEvent) => {
        const transcript = e.results[0]?.transcript ?? '';
        if (e.isFinal) {
          handlers.onFinal(transcript);
        } else {
          handlers.onPartial(transcript);
        }
      },
    ),
    ExpoSpeechRecognitionModule.addListener(
      'error',
      (e: ExpoSpeechRecognitionErrorEvent) => {
        handlers.onError(e.error);
      },
    ),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      handlers.onEnd();
    }),
  ];

  ExpoSpeechRecognitionModule.start({
    lang: 'en-US',
    interimResults: true,
    requiresOnDeviceRecognition: true,
    addsPunctuation: true,
    continuous: false,
  });

  return {
    stop: () => {
      ExpoSpeechRecognitionModule.stop();
      subs.forEach((s) => {
        s.remove();
      });
    },
  };
};
