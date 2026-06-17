import { kv } from '../kv';
describe('kv', () => {
  it('round-trips a value', () => { kv.set('k', 'v'); expect(kv.getString('k')).toBe('v'); });
  it('returns null for a missing key', () => { expect(kv.getString('missing')).toBeNull(); });
  it('deletes a key', () => { kv.set('d', '1'); kv.delete('d'); expect(kv.getString('d')).toBeNull(); });
  it('lists all keys', () => {
    kv.set('a', '1');
    kv.set('b', '2');
    expect(kv.getAllKeys()).toEqual(expect.arrayContaining(['a', 'b']));
  });
  it('clears every key', () => {
    kv.set('x', '1');
    kv.clearAll();
    expect(kv.getAllKeys()).toEqual([]);
    expect(kv.getString('x')).toBeNull();
  });
});
