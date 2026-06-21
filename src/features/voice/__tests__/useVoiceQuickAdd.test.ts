import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useVoiceQuickAdd } from '../useVoiceQuickAdd';
import * as stt from '@/src/services/voice/speechRecognition';
import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/src/services/voice/speechRecognition');
jest.mock('@/src/services/voice/spokenTaskStructurer');
const mockStt = stt as jest.Mocked<typeof stt>;
const mockStructure = structureSpokenTask as jest.MockedFunction<typeof structureSpokenTask>;
const mockPush = router.push as jest.MockedFunction<typeof router.push>;

describe('useVoiceQuickAdd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStt.supportsOnDeviceSpeech.mockReturnValue(true);
    mockStt.requestSpeechPermission.mockResolvedValue(true);
  });

  it('opens Add-Task pre-filled with the transcript once recording finishes', async () => {
    mockStructure.mockResolvedValue({ title: 'Email Sarah', rawTranscript: 'x', source: 'appleLLM' });
    let handlers: stt.SpeechHandlers | undefined;
    mockStt.startSpeech.mockImplementation((h) => { handlers = h; return { stop: jest.fn() }; });
    const { result } = renderHook(() => useVoiceQuickAdd());

    await act(async () => { await result.current.start(); });
    await act(async () => { await handlers!.onFinal('i need to email sarah'); });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(modals)/add-task',
      params: { title: 'Email Sarah' },
    });
  });

  it('does not open Add-Task while still listening', async () => {
    mockStt.startSpeech.mockReturnValue({ stop: jest.fn() });
    const { result } = renderHook(() => useVoiceQuickAdd());

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('listening');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
