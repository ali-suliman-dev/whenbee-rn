import { hasNetworkSttConsent, grantNetworkSttConsent } from '../networkSttConsent';
import { kv } from '@/src/lib/kv';

jest.mock('@/src/lib/kv', () => ({
  kv: { set: jest.fn(), getString: jest.fn(() => null), delete: jest.fn() },
}));

const mockKv = kv as jest.Mocked<typeof kv>;

describe('networkSttConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has no consent by default', () => {
    expect(hasNetworkSttConsent('sv-SE')).toBe(false);
  });

  it('granting consent for one locale leaves another locale un-consented', () => {
    grantNetworkSttConsent('sv-SE');
    expect(mockKv.set).toHaveBeenCalledWith('voice.networkSttConsent.sv-SE', 'true');

    mockKv.getString.mockImplementation((key: string) =>
      key === 'voice.networkSttConsent.sv-SE' ? 'true' : null,
    );

    expect(hasNetworkSttConsent('sv-SE')).toBe(true);
    expect(hasNetworkSttConsent('en-US')).toBe(false);
  });
});
