import { useEffect, useRef } from 'react';
import { View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { analytics } from '@/src/services/analytics';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { resolveUnlockSentence } from './useUnlockSentence';
import { useNextUnlock, type NextUnlock as NextUnlockData } from './useNextUnlock';
import { spokenText } from './a11yText';
import type { CompanionCapability } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// NextUnlock — "what your logs buy you", a one-line row: a key glyph, then the
// full sentence. Shared by Today, the Progress tab, and the reward screen
// (plain-calibration-copy plan, Task 3).
//
// The sentence itself is resolved by `resolveUnlockSentence` — one owner, so
// this row and CalibrationCard's spoken label can never disagree about
// whether the next capability is Pro.
//
// F19: `useNextUnlock()` opens two store subscriptions and recomputes
// `aggregateCalibration` on every call — cheap once, wasteful 2-3x over in one
// card subtree. `CalibrationCard` resolves it ONCE and passes it down via the
// optional `unlock` prop; this component then renders straight off that data
// with no hook call of its own (`NextUnlockView`, below). But `NextUnlock`
// also has to stay usable STANDALONE — the reward screen renders it with no
// parent that resolved anything — so when `unlock` is omitted, `NextUnlockAuto`
// mounts instead and owns the one hook call. Splitting into three components
// (rather than a single component branching on whether to call the hook) is
// what keeps every hook call unconditional, per rules-of-hooks: a component
// either always calls `useNextUnlock()` or never does, and React decides
// which component is mounted, not a branch inside one.
//
// The row owns its own accessibility label so it is never swallowed into a
// neighbouring grouped card describing a DIFFERENT subject (see reward.tsx,
// where the card above it talks about the just-logged category while this row
// talks about the whole companion).
//
// No animation (hard rule) — this row is always rendered at full opacity.
// ──────────────────────────────────────────────────────────────────────────────

/** The screens this row can appear on. The Progress tab renders the full ladder
 *  (`UnlockLadder`), not this row, so it is not a surface here. */
export type UnlockSurface = 'today' | 'reward';

interface NextUnlockProps {
  /** Set on the log that just crossed a tier: render "you unlocked X" instead of
   *  handing the user a fresh target on their payoff screen. */
  justUnlockedId?: CompanionCapability['id'] | null;
  /** Pre-resolved unlock data from a parent that already called
   *  `useNextUnlock()` for the subtree (e.g. `CalibrationCard`) — skips this
   *  component's own store subscription (F19). Omit on a screen with no
   *  upstream resolve (e.g. the reward screen, where this row is standalone);
   *  a fallback hook call fills it in. */
  unlock?: NextUnlockData;
  /** Which screen this row is on — carried into `unlock_sentence_shown` so the
   *  two mount sites can be told apart in the funnel. */
  surface: UnlockSurface;
}

export function NextUnlock({ justUnlockedId = null, unlock, surface }: NextUnlockProps) {
  return unlock === undefined ? (
    <NextUnlockAuto justUnlockedId={justUnlockedId} surface={surface} />
  ) : (
    <NextUnlockView unlock={unlock} justUnlockedId={justUnlockedId} surface={surface} />
  );
}

/** Standalone fallback — the ONE place this file calls `useNextUnlock()`. */
function NextUnlockAuto({
  justUnlockedId,
  surface,
}: {
  justUnlockedId: CompanionCapability['id'] | null;
  surface: UnlockSurface;
}) {
  const unlock = useNextUnlock();
  return <NextUnlockView unlock={unlock} justUnlockedId={justUnlockedId} surface={surface} />;
}

function NextUnlockView({
  unlock,
  justUnlockedId,
  surface,
}: {
  unlock: NextUnlockData;
  justUnlockedId: CompanionCapability['id'] | null;
  surface: UnlockSurface;
}) {
  const t = useTheme();
  const { t: tr } = useTranslation('whenbee');
  const isPro = useEntitlement((s) => s.isPro);
  const sentence = resolveUnlockSentence(unlock, isPro, justUnlockedId, tr);

  // unlock_sentence_shown: once per sentence the user is actually looking at,
  // not per render. Same ref-keyed shape as `honest_suggestion_shown` in
  // useToday — the key is the payload, so a re-render with identical data is
  // silent while a genuine change (new stage, crossed rung, purchase) fires.
  const lastShownRef = useRef<string | null>(null);
  const shownCapability = justUnlockedId ?? unlock.nextCapabilityId;
  useEffect(() => {
    if (sentence === '' || shownCapability === null) return;
    const key = `${surface}|${unlock.stage}|${shownCapability}|${isPro}|${justUnlockedId !== null}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('unlock_sentence_shown', {
      surface,
      stage: unlock.stage,
      capability: shownCapability,
      is_pro: isPro,
      just_earned: justUnlockedId !== null,
    });
  }, [sentence, shownCapability, surface, unlock.stage, isPro, justUnlockedId]);

  // Empty when there's nothing honest to say: the defensive, unreachable-today
  // branch `useNextUnlock` documents (F2 — never print a fabricated count), or
  // the monotonic stage is sealed but the live tier/pct beside it disagrees
  // (F3 — never claim "Calibrated ✦" next to a lower tier word). No row beats
  // a row with a key glyph and no words, or worse, a false one.
  if (sentence === '') return null;

  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
  };
  const line: TextStyle = {
    ...(type.bodySmSemibold as unknown as TextStyle),
    color: t.colors.ink,
    flexShrink: 1,
  };

  return (
    // F10: the ✦ in the sealed sentence is a visual-only cue (see `a11yText`)
    // — spoken through `spokenText` so VoiceOver/TalkBack never announces it.
    <View style={row} accessible accessibilityLabel={spokenText(sentence)}>
      <Ionicons name="key-outline" size={t.iconSize.sm} color={t.colors.amberText} />
      <Text style={line}>{sentence}</Text>
    </View>
  );
}
