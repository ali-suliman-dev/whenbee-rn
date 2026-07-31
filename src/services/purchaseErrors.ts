// ──────────────────────────────────────────────────────────────────────────────
// purchaseErrors — pure classification of RevenueCat purchase rejections, kept
// import-free so UI tests can use the real logic while mocking the store module.
// RC rejections carry `userCancelled` and a PURCHASES_ERROR_CODE `code`;
// duck-typed so the paywall never crashes on an unexpected error shape.
// ──────────────────────────────────────────────────────────────────────────────

/** How the paywall should react to a failed purchase. */
export type PurchaseErrorKind = 'cancelled' | 'declined' | 'other';

const RC_CODE_PURCHASE_CANCELLED = 1;
const RC_CODE_PURCHASE_NOT_ALLOWED = 3;
const RC_CODE_PURCHASE_INVALID = 4;

export function classifyPurchaseError(e: unknown): PurchaseErrorKind {
  if (typeof e !== 'object' || e === null) return 'other';
  const err = e as { userCancelled?: unknown; code?: unknown };
  const code = typeof err.code === 'number' ? err.code : Number(err.code);
  if (err.userCancelled === true || code === RC_CODE_PURCHASE_CANCELLED) return 'cancelled';
  if (code === RC_CODE_PURCHASE_NOT_ALLOWED || code === RC_CODE_PURCHASE_INVALID) return 'declined';
  return 'other';
}
