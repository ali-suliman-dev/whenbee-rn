import { ringCopy } from './ringCopy';

describe('ringCopy', () => {
  it('describes the Setting band with a soft next-stage pull', () => {
    const r = ringCopy(46);
    expect(r.tier).toBe('Setting');
    expect(r.pct).toBe(46);
    expect(r.line).toBe('Getting sharper');
    expect(r.next).toMatch(/^~\d+ logs? to Ripening$/);
    expect(r.sealed).toBe(false);
  });
  it('uses the Raw line at zero', () => {
    expect(ringCopy(0).line).toBe('Just getting started');
    expect(ringCopy(0).tier).toBe('Raw');
  });
  it('holds at the top — sealed, no next stage', () => {
    const r = ringCopy(95);
    expect(r.tier).toBe('Honest');
    expect(r.sealed).toBe(true);
    expect(r.line).toBe('Plans match reality');
    expect(r.next).toBe('Honeycomb sealed ✦');
  });
  it('rounds the percentage', () => {
    expect(ringCopy(63.7).pct).toBe(64);
  });
});
