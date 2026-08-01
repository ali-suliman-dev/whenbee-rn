import {
  getSupportedSpeechLocales,
  supportsOnDeviceSpeech,
  speechPlatform,
} from './speechRecognition';

export interface RecognitionCapability {
  onDeviceAvailable: boolean;
  canDownloadModel: boolean;
  platform: 'ios' | 'android' | 'unsupported';
}

/** Decide, for a concrete BCP-47 locale, whether on-device STT can run now,
 *  whether an offline model could be downloaded (Android), or whether the caller
 *  must fall back to consented network recognition. Never throws. */
export const resolveRecognitionCapability = async (
  sttLocale: string,
): Promise<RecognitionCapability> => {
  const platform = speechPlatform();
  if (platform === 'unsupported') {
    return { onDeviceAvailable: false, canDownloadModel: false, platform };
  }
  const deviceCanOnDevice = supportsOnDeviceSpeech();
  const { locales, installedLocales } = await getSupportedSpeechLocales();
  const installed = installedLocales.includes(sttLocale);
  const known = locales.includes(sttLocale);
  return {
    onDeviceAvailable: deviceCanOnDevice && installed,
    canDownloadModel: platform === 'android' && deviceCanOnDevice && known && !installed,
    platform,
  };
};
