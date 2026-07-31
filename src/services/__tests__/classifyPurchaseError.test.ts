import { classifyPurchaseError } from '../purchaseErrors';

describe('classifyPurchaseError', () => {
  it('flags userCancelled rejections as cancelled', () => {
    expect(classifyPurchaseError({ userCancelled: true })).toBe('cancelled');
    expect(classifyPurchaseError({ code: 1 })).toBe('cancelled');
    expect(classifyPurchaseError({ code: '1' })).toBe('cancelled');
  });

  it('flags not-allowed / invalid purchases as declined', () => {
    expect(classifyPurchaseError({ code: 3 })).toBe('declined');
    expect(classifyPurchaseError({ code: 4 })).toBe('declined');
  });

  it('everything else is other', () => {
    expect(classifyPurchaseError(new Error('network'))).toBe('other');
    expect(classifyPurchaseError({ code: 2 })).toBe('other');
    expect(classifyPurchaseError(null)).toBe('other');
    expect(classifyPurchaseError('boom')).toBe('other');
  });
});
