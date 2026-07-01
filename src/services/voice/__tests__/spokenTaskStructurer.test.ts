import { structureSpokenTask } from '../spokenTaskStructurer';
import { getOnDeviceLlm } from '@/src/services/ai';

jest.mock('@/src/services/ai');
const mockGet = getOnDeviceLlm as jest.MockedFunction<typeof getOnDeviceLlm>;

const llm = (structureImpl: jest.Mock) => {
  mockGet.mockReturnValue({ availability: jest.fn(), structure: structureImpl });
};

describe('structureSpokenTask', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the LLM title when the model returns one (source appleLLM)', async () => {
    llm(jest.fn().mockResolvedValue({ title: 'Write email to Frederick' }));
    const d = await structureSpokenTask('write that email i was thinking about for frederick', 'en');
    expect(d).toEqual({
      title: 'Write email to Frederick',
      rawTranscript: 'write that email i was thinking about for frederick',
      source: 'appleLLM',
    });
  });

  it('falls back to Tier-1 rules when the model returns null', async () => {
    llm(jest.fn().mockResolvedValue(null));
    const d = await structureSpokenTask('i need to reply to the henderson emails', 'en');
    expect(d.title).toBe('Reply to the henderson emails');
    expect(d.source).toBe('rules');
  });

  it('falls back to Tier-1 when the model returns an empty title', async () => {
    llm(jest.fn().mockResolvedValue({ title: '   ' }));
    const d = await structureSpokenTask('remind me to call the dentist', 'en');
    expect(d.title).toBe('Call the dentist');
    expect(d.source).toBe('rules');
  });

  it('passes the Swedish instructions to the LLM for lang sv', async () => {
    const structureImpl = jest.fn().mockResolvedValue({ title: 'Ring tandläkaren' });
    llm(structureImpl);
    await structureSpokenTask('jag måste ringa tandläkaren', 'sv');
    expect(structureImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions:
          'Skriv om användarens talade anteckning till en kort uppgift. Börja med ett verb, ' +
          'imperativ, högst 6 ord, ingen inledning eller utfyllnad. Returnera endast uppgiftens titel.',
      }),
    );
    expect(structureImpl).not.toHaveBeenCalledWith(
      expect.objectContaining({ instructions: expect.stringContaining('Rewrite') }),
    );
  });

  it('falls back to Tier-1 rules (Swedish preamble stripping) when the model returns null, lang sv', async () => {
    llm(jest.fn().mockResolvedValue(null));
    const d = await structureSpokenTask('jag måste ringa tandläkaren', 'sv');
    expect(d.title).toBe('Ringa tandläkaren');
    expect(d.source).toBe('rules');
  });
});
