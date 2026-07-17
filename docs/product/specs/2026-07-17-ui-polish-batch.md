# UI Polish Batch (2026-07-17) — Implementation Plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship one batch of onboarding + settings polish: a redesigned Ready screen, a signature Pro-drawer bee animation, a warm What's New empty state, plus four already-implemented quick fixes, and re-check one Android-only bug.

**Architecture:** All UI, no engine/domain changes except extracting one pure helper (`archetypeTitleFor`). Everything reads existing theme tokens via `useTheme()`. New motion uses Reanimated worklets on the existing `BeeMascot` SVG paths. No new dependencies.

**Tech Stack:** Expo SDK 54, expo-router 6, React Native 0.81 (Fabric), react-native-reanimated 3, react-native-svg, Zustand, theme tokens in `src/theme/tokens.ts`.

## Global Constraints (verbatim, apply to every task)

- Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No inline raw numbers or hex. Add a token if one is missing.
- **Animation invariants:** no spring/bounce/overshoot on content; no translate-in slides; allowed = SVG path draw/fill/morph, opacity fades, subtle scale settle (ease-out, no overshoot), small wiggle. Reduced-motion → final state, no travel. The `Reveal` `FadeInDown` onboarding CTA entrance is the one approved exception (do not touch it).
- **Product invariants:** no guilt/streaks/shame; honey/sharpness monotonic; core loop stays on-device; pricing read from RevenueCat.
- **Copy:** run every user-facing string through `conversion-psychology` + `humanizer`. No AI-slop. No em dashes in new copy (impeccable rule); the existing app voice's em dashes elsewhere stay.
- **Onboarding buttons** use default `AppButton` (md), never `size="lg"`.
- Modals keep `headerShown: false`; sheets start with `<SheetGrabber />`.
- Run `npm run lint` + `npm run typecheck` + affected `npx jest` before each commit; full `npm test` before finishing. No AI/co-author trailers. Use `/init-cmt` for commits.
- **HARD GATES:** never create a branch without asking the founder first; never merge. Open PRs only.
- Founder approves UI only from rendered screenshots (sim `xcrun simctl io booted screenshot`) or the approved HTML mocks in the session scratchpad.

---

## Workstream 0 — Commit the four completed quick fixes

These are already implemented in the working tree (verified on iOS sim). They need device verification + a commit. **Files touched:** `src/app/(modals)/whats-new.tsx`, `src/app/settings.tsx`, `src/features/paywall/Paywall.tsx`, `src/components/PresenceRingTeaser.tsx`.

- [ ] **0.1** Confirm the diff is exactly these four files: `git diff --stat` shows `whats-new.tsx` (+`paddingTop: t.space[5]` on the ScrollView), `settings.tsx` (icon `newspaper-outline`; presence line "Presence is on…"), `Paywall.tsx` (`numberOfLines={1}` on eyebrow), `PresenceRingTeaser.tsx` (ring SVG → filling bar).
- [ ] **0.2** `npx eslint` the four files; `npx tsc --noEmit`; `npx jest src/features/paywall src/app/__tests__/settings.test.tsx` (expect green).
- [ ] **0.3** Ask the founder to branch (per HARD GATE), then commit with `/init-cmt`. Suggested message: `fix(ui): whats-new padding + real icon, one-line Pro badge, presence bar copy`.
- [ ] **0.4** Device-verify on Android (founder device): the presence card shows a **bar** (not ring); the "WHENBEE PRO" badge is one line; What's New has top breathing room; the What's New settings row shows the newspaper icon.

**Note:** `PresenceRingTeaser` keeps its filename to avoid import churn; its header comment already documents the ring→bar change.

---

## Workstream 1 — Ready screen redesign (Archetype crest)

Full redesign of `src/app/(onboarding)/ready.tsx`. Approved mock: scratchpad `ready-mocks-v6.html`. Locked design: archetype-crest editorial, 24px headline, time-style-seed copy, 6C quiet-link nickname, cut the "forgot to time" tip, airy middle, ripening rail low.

### Task 1.1 — Extract a shared `archetypeTitleFor` helper

The Ready kicker needs the archetype title from the stored `archetypeSeed.m0`. Today the m→title map lives in a private `rungFor` inside `usePersonalize.ts`.

**Files:**
- Modify: `src/features/onboarding/usePersonalize.ts` (export the title map as a pure helper)
- Test: `src/features/onboarding/__tests__/archetypeTitleFor.test.ts` (create)

**Interfaces — Produces:** `archetypeTitleFor(m: number): string` returning one of `'The Steady Reader' | 'The Gentle Optimist' | 'The Sprint Optimist' | 'The Dreamer'` using the existing thresholds (`m<1.2`, `m<1.5`, `m<2.0`, else). Titles/thresholds MUST stay identical to the current `rungFor` (and `archetypeFor` in `usePatterns.ts`).

- [ ] **Step 1** Write the failing test:
```ts
import { archetypeTitleFor } from '@/src/features/onboarding/usePersonalize';
test('archetype title ladder', () => {
  expect(archetypeTitleFor(1.0)).toBe('The Steady Reader');
  expect(archetypeTitleFor(1.3)).toBe('The Gentle Optimist');
  expect(archetypeTitleFor(1.7)).toBe('The Sprint Optimist');
  expect(archetypeTitleFor(2.4)).toBe('The Dreamer');
});
```
- [ ] **Step 2** Run: `npx jest archetypeTitleFor` → FAIL (not exported).
- [ ] **Step 3** In `usePersonalize.ts`, export `archetypeTitleFor` and refactor `rungFor` to use it (keep `rungFor` returning `{title, blurb}`; `title = archetypeTitleFor(m)`). Do not change any threshold or string.
- [ ] **Step 4** Run: `npx jest archetypeTitleFor` → PASS. Run existing `npx jest usePersonalize` if present → PASS.
- [ ] **Step 5** Commit: `refactor(onboarding): extract archetypeTitleFor helper`.

### Task 1.2 — Rebuild `ready.tsx`

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx`
- Test: `src/app/(onboarding)/__tests__/ready.test.tsx` (update the existing empty-nickname regression test if present)

**Layout, top → bottom** (all values are tokens; `Reveal` stagger + `OnboardingBackdrop` stay):
1. `StepProgress` (unchanged).
2. **Crest row** (`Reveal index={0}`): `<ArchetypeCrest beeSize={…small…} />` beside a two-line kicker. Kicker line 1 `t.colors.inkFaint` "Your time-style"; line 2 `t.colors.accent` bold uppercase = `archetypeTitleFor(archetypeSeed?.m0 ?? 1)`. If `archetypeSeed` is undefined (skipped quiz), fall back to a neutral kicker "You're calibrated" and no title.
3. **Headline** (`Reveal index={1}`): `fontSize: t.fontSize.xl` (24), bold, `letterSpacing: t.letterSpacing.tight`. Text "Your first honest times are already set." with the word "honest" in `t.colors.accent` (wrap that word in a nested `<AppText>`).
4. **Body** (`Reveal index={2}`): `type.body`, `t.colors.inkSoft`: "I read them from your time-style, so you start with real numbers, not blank guesses. Log a task and they sharpen."
5. **Nickname (6C quiet link)** (`Reveal index={3}`): directly under the body. Collapsed = a single `Pressable` row, no container/border: a `t.colors.primary` "＋" + `t.colors.primary` "Give me a nickname" + `t.colors.inkFaint` "optional". On press → the existing `TextInput` (reuse current styling but keep the state pattern). NO second mascot, NO side-stripe border.
6. `<View style={{ flex: 1 }} />` — airy middle (deliberate).
7. **Ripening rail** (`Reveal index={4}`): a slim 5-segment amber-graded bar (`t.colors.accent` → fading via `t.colors.accentSoft` steps) with labels Raw/Setting/Ripening/Thickening/Honest below (`t.colors.inkFaint`, first `t.colors.accent`). Reuse `HoneyTrail` if it can render this slim; otherwise a small local `RipeningRail` component.
8. **Maker line** (`Reveal index={5}`): centered `type.caption`, "Made by one person." bold + " Tell me what to add, it's in Settings." (no em dash).
9. **CTA** (`Reveal index={6}`): `<AppButton label="Time my first thing →" fullWidth />` (default md). `timeFirstThing` logic unchanged (saveName from nickname, complete(), replace `/(tabs)`, push add-task).

**Removed:** the `ReasonGlyph` "Forgot to time something?" row entirely.

- [ ] **Step 1** Read the current `ready.tsx` and `ArchetypeCrest` props; wire `archetypeSeed` via `useSettingsStore((s) => s.archetypeSeed)`.
- [ ] **Step 2** Implement the layout above. Keep the nickname reveal + `saveName` behavior intact.
- [ ] **Step 3** If `HoneyTrail` can't render the slim rail cleanly, create `src/features/onboarding/RipeningRail.tsx` (pure View bar + labels, tokens only).
- [ ] **Step 4** `npx eslint` the touched files; `npx tsc --noEmit`.
- [ ] **Step 5** Update/keep the empty-nickname regression test; `npx jest ready`.
- [ ] **Step 6** Sim-verify: `xcrun simctl openurl booted "whenbee:///(onboarding)/ready"` then screenshot; compare to `ready-mocks-v6.html`. Confirm 24px headline, crest, quiet nickname link, airy middle, no forgot-tip.
- [ ] **Step 7** Commit: `feat(onboarding): redesign Ready screen around the archetype crest`.

---

## Workstream 2 — Pro-drawer bee animation ("Proud seal")

Give `BeeBurst variant="upgrade"` (rendered in `src/features/paywall/Paywall.tsx`) a signature entrance that plays once on drawer open, then rests with a continuous blink. Approved preview: scratchpad `bee-anim-B.html`.

**Behavior (once, on mount):** ray shimmer sweep (opacity) → ▲ seal scales in (ease-out, no overshoot) → wings buzz (scaleX flutter, ~1.2s) → antennae perk (small rotate) → honey glow blooms (radius/opacity up then settle). **After the wings settle:** both eyes blink continuously (periodic, both eyes together — NO wink) + the existing gentle float. Reduced-motion → final state, no motion.

**Files:**
- Modify: `src/components/BeeMascot.tsx` (expose a one-shot "celebrate" entrance + continuous blink; it already has flutter/blink/look worklets and an `allowFlutter` prop — add a `celebrate?: boolean` prop that runs the entrance sequence once then leaves blink looping)
- Modify: `src/components/bee/BeeBurst.tsx` (pass `celebrate` for `variant === 'upgrade'`; drive the RayBurst opacity sweep + glow bloom + seal scale-in on mount)
- Modify: `src/components/bee/RayBurst.tsx` and/or `CoinBadge.tsx` only if the sweep/seal-in need a mount hook
- Test: `src/components/__tests__/beeBurst.test.tsx` (smoke: renders `variant="upgrade"` without crashing; reduced-motion path renders final state)

**Reanimated notes (from CLAUDE.md):** read/write shared values with `.get()/.set()`; any helper called inside a worklet needs `'worklet';`; NEVER set an `exiting` layout prop (Fabric SIGABRT) — entrance only. Wing flutter = `scaleX` around the wing hinge (existing `WING_FOLD`); blink = eye-rect height collapse to `EYE_SLIT` (existing); glow bloom = the existing halo radius/opacity; seal-in = `CoinBadge` scale 0→1 ease-out. Sequence via `withSequence`/`withDelay` + `withTiming` (no `withSpring` overshoot). Durations from `t.motion` tokens (buzz ~`beeWingBuzz`, entrance beats ≤ motion tokens).

- [ ] **Step 1** Write the smoke test: render `<BeeBurst variant="upgrade" />` under a theme provider; assert it mounts; mock `useReducedMotion` → true and assert no animation drivers start (final state).
- [ ] **Step 2** Run: `npx jest beeBurst` → FAIL.
- [ ] **Step 3** Add `celebrate` to `BeeMascot`: on mount (when `celebrate && !reducedMotion`) run the wing-buzz + antennae-perk sequence once, then start the continuous both-eye blink loop; when reduced-motion, render final (open eyes, wings at rest). Keep existing `flutter`/`look` opt-ins untouched.
- [ ] **Step 4** In `BeeBurst`, for `variant === 'upgrade'`: pass `celebrate`, and on mount drive RayBurst opacity sweep + halo bloom + `CoinBadge` scale-in (ease-out `withTiming`, tokens). Non-upgrade variants keep today's calm float only.
- [ ] **Step 5** Run: `npx jest beeBurst` → PASS. `npx eslint` + `npx tsc --noEmit`.
- [ ] **Step 6** Sim-verify: open the paywall (`whenbee:///paywall?trigger=settings_upgrade`), watch the bee. Screenshot the settled state. Compare motion to `bee-anim-B.html`. Toggle iOS reduce-motion and confirm the bee renders static.
- [ ] **Step 7** Commit: `feat(paywall): signature Pro bee entrance, then continuous blink`.

---

## Workstream 3 — What's New empty state ("Resting bee")

Replace the bare `Nothing new yet.` text in `src/app/(modals)/whats-new.tsx` with a centered resting-bee illustration + warm copy. Approved mock: scratchpad `empty-state-mocks.html` (concept A).

**Files:**
- Create: `src/features/feedback/WhatsNewEmpty.tsx` (the empty-state component: resting `BeeMascot`-style bee with sleepy arc eyes + a soft "zzz", `etitle` + `esub`)
- Modify: `src/app/(modals)/whats-new.tsx` (render `<WhatsNewEmpty />` in the `changelog.length === 0 && !loading` branch instead of the plain `AppText`)
- Test: `src/features/feedback/__tests__/whatsNewEmpty.test.tsx` (renders title + subtitle text)

**Copy (humanized/conversion):** title `type.titleSm`/`t.colors.ink` "All quiet for now"; subtitle `type.bodySm`/`t.colors.inkSoft`, centered, max ~230: "When I ship something you asked for, it lands right here." (ties to the feedback loop = a reason to return; no guilt, no em dash).

**Illustration:** simplest path — render the existing `BeeMascot` at a calm size with a resting expression. If `BeeMascot` can't show closed/sleepy eyes via a prop, add a small `sleepy?: boolean` variant that swaps the two eye rects for short downward arc `Path`s (see `empty-state-mocks.html` for the arc `d` values), and draw three amber "z" glyphs (`t.colors.accent`, decreasing size/opacity) at the upper-right. Center vertically in the drawer's empty area. Static (no animation required); an optional idle breathing scale can be a fast-follow.

- [ ] **Step 1** Write the test: render `<WhatsNewEmpty />`, assert "All quiet for now" and the subtitle are present.
- [ ] **Step 2** Run: `npx jest whatsNewEmpty` → FAIL.
- [ ] **Step 3** Build `WhatsNewEmpty.tsx` (resting bee + copy, tokens only, centered column with `t.space` gaps).
- [ ] **Step 4** Wire it into `whats-new.tsx` empty branch.
- [ ] **Step 5** Run: `npx jest whatsNewEmpty` → PASS. `npx eslint` + `npx tsc --noEmit`.
- [ ] **Step 6** Sim-verify (fresh install / no changelog): `whenbee:///whats-new`, screenshot, compare to concept A.
- [ ] **Step 7** Commit: `feat(feedback): warm resting-bee empty state for What's New`.

---

## Workstream 4 — Android CTA-text bug re-check (deferred)

Founder reported the add-task primary CTA label vanishing when it enables, on Android physical only. NOT reproducible on iOS sim; the disabled-restyle commit left the enabled path byte-identical. Founder suspects a stale/corrupt device build.

- [ ] **4.1** After a **fresh** Android build (data-safe: no prebuild, versionCode stays 3 — see CLAUDE.md), reproduce: voice quick-add → pick a category → observe the "Add & start timer" label when it enables.
- [ ] **4.2** If it still repros: `superpowers:systematic-debugging` on Android specifically — capture `adb exec-out screencap` of the enabled state, inspect the filled-button paint order (`edgeBase` sibling z-order / `overflow:hidden` on the face) on Android. Only then propose a fix.
- [ ] **4.3** If it does NOT repro on the fresh build: close the bug as a stale-build artifact; note it in `addtask-cta-text-bug` memory.

---

## Execution notes

- **Order:** Workstream 0 (commit done work) is independent and can land first. 1, 2, 3 are independent of each other. 4 is gated on a device build.
- **Branching:** ask the founder before creating any branch. Consider one branch per workstream (cleaner PRs) or one `feat/ui-polish-2026-07` branch — founder's call.
- **Verification is visual:** every UI task ends with a sim screenshot compared to the approved mock; the founder gives final visual approval.
- **Never merge.** Open the PR(s) and stop.

## Self-review coverage

- Ready redesign (1.1, 1.2) ✓ · Pro bee animation (WS2) ✓ · Empty state (WS3) ✓ · Quick fixes commit + device verify (WS0) ✓ · Android bug recheck (WS4) ✓. No placeholders; the one new type (`archetypeTitleFor`) is defined in Task 1.1 and consumed in 1.2.
