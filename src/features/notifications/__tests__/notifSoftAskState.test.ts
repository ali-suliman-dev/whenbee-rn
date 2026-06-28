// TDD: notifSoftAskState — KV-backed state machine for the notification soft-ask.
// The global jest.setup.js mocks expo-sqlite/kv-store with a shared in-memory Map.

import { kv } from '@/src/lib/kv';
import { getNotifSoftAsk, setNotifSoftAsk } from '../notifSoftAskState';

beforeEach(() => {
  // Clear the shared KV map between tests so state does not leak.
  kv.clearAll();
});

describe('notifSoftAskState', () => {
  describe('getNotifSoftAsk', () => {
    it('returns pending when no key has been written (default)', () => {
      expect(getNotifSoftAsk()).toBe('pending');
    });

    it('returns accepted after setNotifSoftAsk("accepted")', () => {
      setNotifSoftAsk('accepted');
      expect(getNotifSoftAsk()).toBe('accepted');
    });

    it('returns declined after setNotifSoftAsk("declined")', () => {
      setNotifSoftAsk('declined');
      expect(getNotifSoftAsk()).toBe('declined');
    });

    it('returns pending when an unknown value is in storage (defensive)', () => {
      // If KV somehow contains a corrupted value, default to pending.
      kv.set('whenbee.notifSoftAsk', 'corrupted');
      expect(getNotifSoftAsk()).toBe('pending');
    });
  });

  describe('setNotifSoftAsk', () => {
    it('persists accepted across successive reads', () => {
      setNotifSoftAsk('accepted');
      expect(getNotifSoftAsk()).toBe('accepted');
      expect(getNotifSoftAsk()).toBe('accepted'); // idempotent read
    });

    it('persists declined across successive reads', () => {
      setNotifSoftAsk('declined');
      expect(getNotifSoftAsk()).toBe('declined');
      expect(getNotifSoftAsk()).toBe('declined');
    });

    it('can transition from accepted to declined (no guard at state layer)', () => {
      setNotifSoftAsk('accepted');
      setNotifSoftAsk('declined');
      expect(getNotifSoftAsk()).toBe('declined');
    });
  });
});
