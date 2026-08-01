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
//
// The Pro branches exist because two of the six ladder capabilities sit behind
// the paywall (`capabilityGating.ts`). Naming a Pro feature is fine — a feature
// NAME is not a gated VALUE — but promising it as a logging reward would walk a
// free user into a paywall for something the app said they earned. The sentence
// states a fact: no countdown, no nag, no guilt.
// ──────────────────────────────────────────────────────────────────────────────

/** @param justUnlockedId set on the log that just crossed a tier; null otherwise. */
export function useUnlockSentence(justUnlockedId: CompanionCapability['id'] | null = null): string {
  const { t: tr } = useTranslation('whenbee');
  const { nextCapabilityLabel, nextCapabilityIsPro, logsToNext } = useNextUnlock();
  const isPro = useEntitlement((s) => s.isPro);

  if (justUnlockedId !== null) {
    const capability = capabilityLabel(justUnlockedId, tr);
    return !isPro && isCapabilityPro(justUnlockedId)
      ? tr('ladder.justUnlockedPro', { capability })
      : tr('ladder.justUnlocked', { capability });
  }
  // Narrow on the label itself so TypeScript proves it's a string below — no
  // `??` fallback, no `!` assertion.
  if (nextCapabilityLabel === null) return tr('ring.sealed');
  const vars = { count: logsToNext, capability: nextCapabilityLabel };
  return !isPro && nextCapabilityIsPro ? tr('ladder.rowPro', vars) : tr('ladder.row', vars);
}
