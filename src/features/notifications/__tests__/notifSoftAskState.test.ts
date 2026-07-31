// TDD: notifSoftAskState — KV-backed state machine for the notification soft-ask.
// The global jest.setup.js mocks expo-sqlite/kv-store with a shared in-memory Map.

import { kv } from '@/src/lib/kv';
import {
  getNotifSoftAsk,
  setNotifSoftAsk,
  recordNotifSoftAskDecline,
  getNotifReaskMeta,
  ensureDeclineMeta,
  markNotifReaskUsed,
} from '../notifSoftAskState';

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

  // ── re-ask metadata (the once-ever re-ask after a decline) ──────────────────
  describe('re-ask metadata', () => {
    it('recordNotifSoftAskDecline sets declined + stamps when and at what log count', () => {
      recordNotifSoftAskDecline(3, 1_000);
      expect(getNotifSoftAsk()).toBe('declined');
      expect(getNotifReaskMeta()).toEqual({ used: false, declinedAtMs: 1_000, nectarAtDecline: 3 });
    });

    it('meta defaults: not used, no stamps', () => {
      expect(getNotifReaskMeta()).toEqual({ used: false, declinedAtMs: null, nectarAtDecline: null });
    });

    it('markNotifReaskUsed spends the one-shot budget permanently', () => {
      recordNotifSoftAskDecline(1, 500);
      markNotifReaskUsed();
      expect(getNotifReaskMeta().used).toBe(true);
    });

    // Backfill: users who declined BEFORE this feature existed have status
    // 'declined' but no stamps — the first eligibility check stamps "now" so the
    // ≥3-day / ≥5-log clocks start from that moment, never retroactively.
    it('ensureDeclineMeta backfills missing stamps for a pre-existing decline', () => {
      setNotifSoftAsk('declined'); // legacy decline, no meta
      ensureDeclineMeta(7, 9_000);
      expect(getNotifReaskMeta()).toEqual({ used: false, declinedAtMs: 9_000, nectarAtDecline: 7 });
    });

    it('ensureDeclineMeta never overwrites existing stamps', () => {
      recordNotifSoftAskDecline(2, 1_000);
      ensureDeclineMeta(9, 99_000);
      expect(getNotifReaskMeta()).toEqual({ used: false, declinedAtMs: 1_000, nectarAtDecline: 2 });
    });

    it('ensureDeclineMeta is a no-op when status is not declined', () => {
      ensureDeclineMeta(5, 5_000);
      expect(getNotifReaskMeta().declinedAtMs).toBeNull();
    });
  });
});
