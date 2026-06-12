import { kv } from '../kv';
describe('kv', () => {
  it('round-trips a value', () => { kv.set('k', 'v'); expect(kv.getString('k')).toBe('v'); });
  it('returns null for a missing key', () => { expect(kv.getString('missing')).toBeNull(); });
  it('deletes a key', () => { kv.set('d', '1'); kv.delete('d'); expect(kv.getString('d')).toBeNull(); });
});
