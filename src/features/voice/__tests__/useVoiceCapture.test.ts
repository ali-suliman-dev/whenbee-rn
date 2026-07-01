import { act, renderHook } from '@testing-library/react-native';
import { useVoiceCapture } from '../useVoiceCapture';
import * as stt from '@/src/services/voice/speechRecognition';
import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';
import { resolveRecognitionCapability } from '@/src/services/voice/recognitionCapability';
import { hasNetworkSttConsent, grantNetworkSttConsent } from '@/src/services/voice/networkSttConsent';

jest.mock('@/src/services/voice/speechRecognition');
jest.mock('@/src/services/voice/spokenTaskStructurer');
jest.mock('@/src/services/voice/recognitionCapability');
jest.mock('@/src/services/voice/networkSttConsent');

const mockStt = stt as jest.Mocked<typeof stt>;
const mockStructure = structureSpokenTask as jest.MockedFunction<typeof structureSpokenTask>;
const mockResolveCapability = resolveRecognitionCapability as jest.MockedFunction<
  typeof resolveRecognitionCapability
>;
const mockHasConsent = hasNetworkSttConsent as jest.MockedFunction<typeof hasNetworkSttConsent>;
const mockGrantConsent = grantNetworkSttConsent as jest.MockedFunction<typeof grantNetworkSttConsent>;

describe('useVoiceCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStt.requestSpeechPermission.mockResolvedValue(true);
    mockStt.startSpeech.mockReturnValue({ stop: jest.fn() });
    mockStt.downloadOfflineModel.mockResolvedValue(true);
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: true,
      canDownloadModel: false,
      platform: 'ios',
    });
    mockHasConsent.mockReturnValue(false);
  });

  it('starts listening on-device when the capability is available', async () => {
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('listening');
    expect(mockStt.startSpeech).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiresOnDevice: true }),
    );
  });

  it('sets denied status when permission is refused', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('denied');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('emits a structured draft on final transcript and returns to idle', async () => {
    mockStructure.mockResolvedValue({ title: 'Email Sarah', rawTranscript: 'x', source: 'appleLLM' });
    let handlers: stt.SpeechHandlers | undefined;
    mockStt.startSpeech.mockImplementation((h) => {
      handlers = h;
      return { stop: jest.fn() };
    });
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await handlers!.onFinal('i need to email sarah');
    });

    expect(mockStructure).toHaveBeenCalledWith('i need to email sarah');
    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ title: 'Email Sarah' }));
    expect(result.current.status).toBe('idle');
  });

  it('reports unavailable when the platform is unsupported', async () => {
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: false,
      canDownloadModel: false,
      platform: 'unsupported',
    });
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('unavailable');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('reports needsDownload on Android when an offline model can be downloaded, without starting', async () => {
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: false,
      canDownloadModel: true,
      platform: 'android',
    });
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('needsDownload');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('reports needsNetworkConsent when on-device is unavailable and there is no consent yet', async () => {
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: false,
      canDownloadModel: false,
      platform: 'ios',
    });
    mockHasConsent.mockReturnValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('needsNetworkConsent');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('starts with requiresOnDevice: false once network consent is present', async () => {
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: false,
      canDownloadModel: false,
      platform: 'ios',
    });
    mockHasConsent.mockReturnValue(true);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe('listening');
    expect(mockStt.startSpeech).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiresOnDevice: false }),
    );
  });

  it('confirmNetworkConsent grants consent for the current locale then starts', async () => {
    mockResolveCapability.mockResolvedValue({
      onDeviceAvailable: false,
      canDownloadModel: false,
      platform: 'ios',
    });
    mockHasConsent.mockReturnValueOnce(false).mockReturnValue(true);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('needsNetworkConsent');

    await act(async () => {
      await result.current.confirmNetworkConsent();
    });

    expect(mockGrantConsent).toHaveBeenCalledWith('en-US');
    expect(result.current.status).toBe('listening');
    expect(mockStt.startSpeech).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ requiresOnDevice: false }),
    );
  });

  it('triggerDownload downloads the offline model for the current locale then starts', async () => {
    mockResolveCapability
      .mockResolvedValueOnce({ onDeviceAvailable: false, canDownloadModel: true, platform: 'android' })
      .mockResolvedValueOnce({ onDeviceAvailable: true, canDownloadModel: false, platform: 'android' });
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe('needsDownload');

    await act(async () => {
      await result.current.triggerDownload();
    });

    expect(mockStt.downloadOfflineModel).toHaveBeenCalledWith('en-US');
    expect(result.current.status).toBe('listening');
  });
});
