import { useTranslation } from 'react-i18next';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import type { CompanionCapability } from '@/src/engine';
import { capabilityLabel } from './capabilityCopy';
import { isCapabilityPro } from './capabilityGating';
import { useNextUnlock } from './useNextUnlock';

// ──────────────────────────────────────────────────────────────────────────────
// useUnlockSentence — the ONE resolver for "what your logs buy you" as a
// sentence. `NextUnlock` renders it; `CalibrationCard` also folds it into its
// grouped accessibility label, and the two used to compose it independently —
// which is how the visible row could say "a Pro feature" while the spoken label
// promised it outright.
//
// Every branch is a SINGLE translation key, never fragments glued in JS:
//
//   ladder.justUnlocked / ladder.justUnlockedPro  what THIS log just bought
//   ladder.row_* / ladder.rowPro_*                the next capability
//   ring.sealed                                   nothing further for logs to buy
//   '' (empty)                                     nothing honest to say — see below
//
// The Pro branches exist because two of the six ladder capabilities sit behind
// the paywall (`capabilityGating.ts`). Naming a Pro feature is fine — a feature
// NAME is not a gated VALUE — but promising it as a logging reward would walk a
// free user into a paywall for something the app said they earned. The sentence
// states a fact: no countdown, no nag, no guilt.
//
// `ring.sealed` is gated on `visibleSealed`, not the monotonic `sealed` — see
// `useNextUnlock`'s header comment (F3). The empty string is the suppression
// branch for that mismatch, and separately for F2's unreachable-but-defensive
// missing-threshold case; `NextUnlock` renders nothing rather than a row with
// a key glyph and no words.
// ──────────────────────────────────────────────────────────────────────────────

/** @param justUnlockedId set on the log that just crossed a tier; null otherwise. */
export function useUnlockSentence(justUnlockedId: CompanionCapability['id'] | null = null): string {
  const { t: tr } = useTranslation('whenbee');
  const { nextCapabilityLabel, nextCapabilityIsPro, logsToNext, visibleSealed } = useNextUnlock();
  const isPro = useEntitlement((s) => s.isPro);

  if (justUnlockedId !== null) {
    const capability = capabilityLabel(justUnlockedId, tr);
    return !isPro && isCapabilityPro(justUnlockedId)
      ? tr('ladder.justUnlockedPro', { capability })
      : tr('ladder.justUnlocked', { capability });
  }
  if (nextCapabilityLabel === null) {
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
  return !isPro && nextCapabilityIsPro ? tr('ladder.rowPro', vars) : tr('ladder.row', vars);
}
