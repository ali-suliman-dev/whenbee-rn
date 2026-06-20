import { act, renderHook } from '@testing-library/react-native';
import { useVoiceCapture } from '../useVoiceCapture';
import * as stt from '@/src/services/voice/speechRecognition';

jest.mock('@/src/services/voice/speechRecognition');
const mockStt = stt as jest.Mocked<typeof stt>;

describe('useVoiceCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStt.supportsOnDeviceSpeech.mockReturnValue(true);
  });

  it('starts listening when permission is granted', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(true);
    mockStt.startSpeech.mockReturnValue({ stop: jest.fn() });
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('listening');
    expect(mockStt.startSpeech).toHaveBeenCalled();
  });

  it('sets denied status when permission is refused', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('denied');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('emits a parsed draft on final transcript and returns to idle', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(true);
    let handlers: stt.SpeechHandlers | undefined;
    mockStt.startSpeech.mockImplementation((h) => { handlers = h; return { stop: jest.fn() }; });
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => { await result.current.start(); });
    await act(async () => { handlers!.onFinal('i need to email sarah'); });

    expect(onDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Email sarah', source: 'rules' }),
    );
    expect(result.current.status).toBe('idle');
  });

  it('reports unavailable when the device lacks on-device speech', async () => {
    mockStt.supportsOnDeviceSpeech.mockReturnValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('unavailable');
  });
});
