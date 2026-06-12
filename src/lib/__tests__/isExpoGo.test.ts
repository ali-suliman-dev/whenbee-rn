import { computeIsExpoGo } from '../isExpoGo';
describe('computeIsExpoGo', () => {
  it('is true in the store client', () => { expect(computeIsExpoGo('storeClient')).toBe(true); });
  it('is false in a standalone/dev build', () => { expect(computeIsExpoGo('standalone')).toBe(false); expect(computeIsExpoGo('bare')).toBe(false); });
});
