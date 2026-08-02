import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { CompanionCapability } from '@/src/engine';
import { capabilityLabel } from './capabilityCopy';
import { isCapabilityStageGated } from './capabilityGating';
import { useNextUnlock, type NextUnlock } from './useNextUnlock';

// ──────────────────────────────────────────────────────────────────────────────
// useUnlockSentence — the ONE resolver for "what your logs buy you" as a
// sentence. `NextUnlock` renders it; `CalibrationCard` also folds it into its
// grouped accessibility label, and the two used to compose it independently —
// which is how the visible row could say "a Pro feature" while the spoken label
// promised it outright.
//
// Every branch is a SINGLE translation key, never fragments glued in JS. There
// are TWO shapes for "the next capability", chosen by `isCapabilityStageGated`
// (F1, 2026-08-02): only `drift-recalibration` is a real feature gate — logs
// crossing every other rung's tier merely make that capability's own accuracy
// sharper, they don't reveal anything that wasn't already there.
//
//   ladder.sharpen_* / ladder.sharpenPro_*   the next capability, NOT gated
//   ladder.unlock_*                          the next capability, genuinely gated
//   ladder.justSharpened                     what THIS log just sharpened, not gated
//   ladder.justUnlocked                      what THIS log just unlocked, gated
//   ring.sealed                              nothing further for logs to buy
//   '' (empty)                                nothing honest to say — see below
//
// The Pro branches exist because two of the six ladder capabilities sit behind
// the paywall (`capabilityGating.ts`) — independently of whether they're stage-
// gated; start-by-anchor/honest-day-forecast are Pro but NOT stage-gated, and
// the one stage-gated rung (drift-recalibration) is free. Naming a Pro feature
// is fine — a feature NAME is not a gated VALUE — but promising it as a
// logging reward would walk a free user into a paywall for something the app
// said they earned. `justSharpened` has no Pro variant: it's a fact about
// accuracy the crossing log measured, not an offer, so it never mentions Pro.
//
// `ring.sealed` is gated on `visibleSealed`, not the monotonic `sealed` — see
// `useNextUnlock`'s header comment (F3). The empty string is the suppression
// branch for that mismatch, and separately for F2's unreachable-but-defensive
// missing-threshold case; `NextUnlock` renders nothing rather than a row with
// a key glyph and no words.
//
// `resolveUnlockSentence` is the pure core (no hooks) — a caller that already
// resolved `NextUnlock` once for its subtree (F19: `useNextUnlock` opens two
// store subscriptions + an `aggregateCalibration` recompute every time it's
// called, and re-deriving it 2-3x in one card tree is wasted work for a
// provably identical result) calls it directly instead of re-subscribing via
// `useUnlockSentence`. `useUnlockSentence` stays the auto-fetching hook for a
// caller with no upstream resolve (e.g. the reward screen's standalone
// `<NextUnlock/>`).
// ──────────────────────────────────────────────────────────────────────────────

export function resolveUnlockSentence(
  unlock: NextUnlock,
  isPro: boolean,
  justUnlockedId: CompanionCapability['id'] | null,
  tr: TFunction<'whenbee'>,
): string {
  const { nextCapabilityId, nextCapabilityLabel, nextCapabilityIsPro, logsToNext, visibleSealed } = unlock;

  if (justUnlockedId !== null) {
    const capability = capabilityLabel(justUnlockedId, tr);
    return isCapabilityStageGated(justUnlockedId)
      ? tr('ladder.justUnlocked', { capability })
      : tr('ladder.justSharpened', { capability });
  }
  if (nextCapabilityId === null || nextCapabilityLabel === null) {
    // `nextCapabilityLabel === null` means the MONOTONIC stage is sealed —
    // but "Calibrated ✦" is a claim about the number beside it, so it only
    // renders when the LIVE tier backs that claim up too (`visibleSealed`,
    // the same source as the visible tier word/percentage). When the two
    // disagree — the monotonic stage stays sealed but the lead category was
    // reset/deleted and its live tier fell — there is no capability left to
    // name (the tier ladder genuinely has nothing more for logs to buy) AND
    // no honest "sealed" claim to make either, so the line is suppressed
    // rather than shown inconsistent with the number next to it (F3).
    return visibleSealed ? tr('ring.sealed') : '';
  }
  // logsToNext is null only in the defensive branch `useNextUnlock` documents
  // as unreachable today (a threshold read coming back undefined) — suppress
  // the sentence rather than print a fabricated count (F2).
  if (logsToNext === null) return '';
  const vars = { count: logsToNext, capability: nextCapabilityLabel };
  if (isCapabilityStageGated(nextCapabilityId)) return tr('ladder.unlock', vars);
  return !isPro && nextCapabilityIsPro ? tr('ladder.sharpenPro', vars) : tr('ladder.sharpen', vars);
}

/** @param justUnlockedId set on the log that just crossed a tier; null otherwise. */
export function useUnlockSentence(justUnlockedId: CompanionCapability['id'] | null = null): string {
  const { t: tr } = useTranslation('whenbee');
  const unlock = useNextUnlock();
  const isPro = useEntitlement((s) => s.isPro);
  return resolveUnlockSentence(unlock, isPro, justUnlockedId, tr);
}
