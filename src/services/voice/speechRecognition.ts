// On-device speech-to-text wrapper. Forces local recognition so audio never
// leaves the phone (core-loop invariant). Guards Expo Go (native module absent)
// and degrades to a no-op session so callers never crash.

import { requireOptionalNativeModule } from 'expo';
import { isExpoGo } from '@/src/lib/isExpoGo';
import type {
  ExpoSpeechRecognitionModule as ExpoSpeechRecognitionModuleValue,
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

// Resolve the native module optionally. `expo-speech-recognition` calls
// `requireNativeModule(...)` at the top of its own module body, so a plain value
// import throws at *import time* whenever the native binary lacks the module —
// in Expo Go, or in a dev client built before the package was added. That crash
// happens before any isExpoGo guard below can run and takes down the whole route
// graph. `requireOptionalNativeModule` returns null instead of throwing, so the
// guards do their job and callers degrade to a no-op session.
const ExpoSpeechRecognitionModule =
  requireOptionalNativeModule<typeof ExpoSpeechRecognitionModuleValue>(
    'ExpoSpeechRecognition',
  );

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
  if (isExpoGo || !ExpoSpeechRecognitionModule) return false;
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
};

export const requestSpeechPermission = async (): Promise<boolean> => {
  if (isExpoGo || !ExpoSpeechRecognitionModule) return false;
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
};

export const startSpeech = (handlers: SpeechHandlers): SpeechSession => {
  if (isExpoGo || !ExpoSpeechRecognitionModule) {
    handlers.onError('expo-go-unsupported');
    return NOOP_SESSION;
  }
  const speech = ExpoSpeechRecognitionModule;

  const subs = [
    speech.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
      const transcript = e.results[0]?.transcript ?? '';
      if (e.isFinal) {
        handlers.onFinal(transcript);
      } else {
        handlers.onPartial(transcript);
      }
    }),
    speech.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
      handlers.onError(e.error);
    }),
    speech.addListener('end', () => {
      handlers.onEnd();
    }),
  ];

  speech.start({
    lang: 'en-US',
    interimResults: true,
    requiresOnDeviceRecognition: true,
    addsPunctuation: true,
    continuous: false,
  });

  return {
    stop: () => {
      speech.stop();
      subs.forEach((s) => {
        s.remove();
      });
    },
  };
};
