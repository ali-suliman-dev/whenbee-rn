import { resolveRecognitionCapability } from '../recognitionCapability';
import * as sr from '../speechRecognition';

jest.mock('../speechRecognition', () => ({
  getSupportedSpeechLocales: jest.fn(),
  supportsOnDeviceSpeech: jest.fn(),
  speechPlatform: jest.fn(),
}));

describe('resolveRecognitionCapability', () => {
  it('iOS with the locale installed → on-device available', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('ios');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: ['en-US', 'sv-SE'], installedLocales: ['sv-SE'],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap).toEqual({ onDeviceAvailable: true, canDownloadModel: false, platform: 'ios' });
  });

  it('Android with the locale NOT installed but downloadable → needs download', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('android');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: ['sv-SE'], installedLocales: [],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap).toEqual({ onDeviceAvailable: false, canDownloadModel: true, platform: 'android' });
  });

  it('locale unsupported entirely → nothing on-device', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('android');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: [], installedLocales: [],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap.onDeviceAvailable).toBe(false);
    expect(cap.canDownloadModel).toBe(false);
  });
});
