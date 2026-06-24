# Ripening-Pro Preview UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the honey-gated Pro preview on the Whenbee hub — a single card that ripens with calibration maturity (state A: settling/blur + honey bar; state B: reveal "Whenbee knows you now" + sharp band + per-feature readiness + amber CTA), driven by the `getProReadiness` selector shipped in PR #20.

**Architecture:** A pure presentational `RipeningProCard` (in `src/components/`) renders one of two states from props. `useWhenbeeHub` exposes a `proReadiness` view-model field (reading the store's `getProReadiness`). `WhenbeeHub` swaps the existing `!isPro` upsell branch to render `RipeningProCard`. Motion (honey fill, settle→sharp band, reveal entrance) is Reanimated, entering-only, reduced-motion safe. All copy passes the conversion + humanizer skills. No new native deps — the "settling" look is low-opacity ghost geometry (NOT a native gaussian blur), matching the existing `HonestBandLockedTeaser`.

**Tech Stack:** React Native (Expo SDK 54), expo-router, Reanimated 3, react-native-svg, Zustand, Jest + @testing-library/react-native.

**Depends on:** PR #20 (`feat/honey-maturity-logic`) merged — specifically `useCalibrationStore.getProReadiness()` and `ProFeatureId`. Branch this work FROM that branch (or main once #20 lands).

## Global Constraints

- Every spacing/size/font/color value MUST come from a `src/theme/tokens.ts` token via `useTheme()`. No inline hex or raw numbers. Add a token to `tokens.ts` if one is missing (and add the matching line in `useTheme`'s resolve map).
- Amber (`colors.accent`/`accentEdge`) = honey/Pro. The Pro CTA is amber with a coin-edge (View-based darker bottom edge), flat — NEVER indigo, NEVER `boxShadow` (RN 0.81 Fabric renders it as a hard line).
- Indigo (`colors.primary`) stays the hero accent — only the honest band + the quiet text link use it.
- No guilt, no streaks: ripening reads as "becoming true," never "locked out" or "behind". Honey/sharpness is monotonic.
- `src/components/**` must NOT import `@/src/services/*` or `@/src/db/*` — route through the store / feature hook. (analytics import is allowed where existing components already use it — follow the existing teaser pattern which calls `analytics` from a feature dir; keep service calls in the feature/hook layer, pass handlers as props into `src/components/`.)
- Pressable stays a bare touch wrapper; visual style on an inner View (reactCompiler + nativewind drop function-form Pressable styles). Reanimated shared values via `.get()/.set()`.
- Entering-only animations. NO `exiting` layout animations on conditionally-unmounted views (Fabric SIGABRT). Imported helpers called inside worklets need `'worklet';`.
- Footers/pinned bottom content add `useSafeAreaInsets().bottom`.
- This gates PRESENTATION only. Buying still routes to the existing paywall modal `/(modals)/paywall`; entitlement stays in RevenueCat. Pricing never hardcoded.
- Conventional Commits; NEVER any AI/co-author attribution trailer. Commit with plain git (NOT the init-cmt skill — its interactive gate stalls subagents).
- Verify: `npm run lint` (0 warnings), `npm run typecheck`, `npx jest <path>`.

## Reference files (read, follow the patterns — do not restructure)

- `src/features/reward/HoneyBar.tsx` — the amber fill bar + `motion.honeyFill` easing. REUSE for the honey progress.
- `src/features/whenbee/HoneyRing.tsx` — ring fill motion, `endowedPct` floor, reduced-motion handling. Pattern reference for the band morph.
- `src/features/shared/HonestBandLockedTeaser.tsx` — ghost-band geometry, `router.push` to `/(modals)/paywall` with a `trigger` param, analytics tap pattern.
- `src/features/whenbee/WhenbeeHub.tsx` (the `!isPro` branch around line 176 renders `ProUpsellCard`) and `src/features/whenbee/useWhenbeeHub.ts` (VM shape, `cells`, `leadSharpness`, `tier`).
- `src/components/ProUpsellCard.tsx` — existing upsell card style to stay visually consistent with.
- `src/theme/typography.ts` (`type.*`) and `src/theme/tokens.ts` (`colors`, `space`, `radii`, `fontWeight`, `motion`, `progress`).

## Visual reference

Approved mock: `docs/superpowers/specs/assets/2026-06-20-ripening-pro-mock.html` (mock) rendered to `2026-06-20-ripening-pro-mock.png` (two states, real tokens). Match its layout, spacing rhythm, and the amber coin-edge CTA.

---

## File Structure

- `src/features/whenbee/useWhenbeeHub.ts` (modify) — add `proReadiness` to the VM.
- `src/features/whenbee/__tests__/useWhenbeeHub.test.ts` (modify) — VM exposes readiness.
- `src/components/ripening-pro/RipeningProCard.tsx` (create) — the two-state card (pure, props-driven).
- `src/components/ripening-pro/RipeningBand.tsx` (create) — settling (ghost, low-opacity) ↔ sharp (ticked) band, animated.
- `src/components/ripening-pro/FeatureReadinessList.tsx` (create) — per-feature ready/ripening rows.
- `src/components/ripening-pro/copy.ts` (create) — all user-facing strings in one place (copy-skill output).
- `src/components/ripening-pro/__tests__/RipeningProCard.test.tsx` (create) — state selection + tap handlers.
- `src/features/whenbee/WhenbeeHub.tsx` (modify) — render `RipeningProCard` in the non-Pro branch; wire handlers + analytics.
- `src/theme/tokens.ts` (modify, only if a needed value is missing) — e.g. a `proPreview` group for blur-opacity / band tick sizes.

---

### Task 1: Expose `proReadiness` from `useWhenbeeHub`

**Files:**
- Modify: `src/features/whenbee/useWhenbeeHub.ts`
- Test: `src/features/whenbee/__tests__/useWhenbeeHub.test.ts`

**Interfaces:**
- Consumes: `useCalibrationStore.getProReadiness()` → `{ pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> }`; existing `vm.leadSharpness`, `vm.tier`.
- Produces: `WhenbeeHubVM.proReadiness: { pitchUnlocked: boolean; perFeatureReady: Record<ProFeatureId, boolean> }` and `WhenbeeHubVM.honeyPct: number` (= `Math.round(leadSharpness)`).

- [ ] **Step 1: Write the failing test**

Add to `src/features/whenbee/__tests__/useWhenbeeHub.test.ts` (follow the existing render/act + store-seed setup already in that file):

```ts
it('exposes pro readiness and honey pct in the VM', () => {
  // seed the calibration store so getProReadiness().pitchUnlocked is false at raw
  const { result } = renderHook(() => useWhenbeeHub());
  expect(result.current.proReadiness).toBeDefined();
  expect(typeof result.current.proReadiness.pitchUnlocked).toBe('boolean');
  expect(typeof result.current.honeyPct).toBe('number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/useWhenbeeHub.test.ts -t "pro readiness"`
Expected: FAIL — `proReadiness` undefined.

- [ ] **Step 3: Implement**

In `useWhenbeeHub.ts`: read `const getProReadiness = useCalibrationStore((s) => s.getProReadiness);` and compute `const proReadiness = useMemo(() => getProReadiness(), [getProReadiness, statsByCategory, focusTick]);` (recompute when stats change or on focus). Add `honeyPct: Math.round(leadSharpness)` and `proReadiness` to the returned VM and to the `WhenbeeHubVM` interface.

- [ ] **Step 4: Run test + typecheck**

Run: `npx jest src/features/whenbee/__tests__/useWhenbeeHub.test.ts -t "pro readiness" && npm run typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/whenbee/useWhenbeeHub.ts src/features/whenbee/__tests__/useWhenbeeHub.test.ts
git commit -m "feat(whenbee): expose pro readiness in hub view-model"
```

---

### Task 2: Copy module (conversion + humanizer)

**Files:**
- Create: `src/components/ripening-pro/copy.ts`

**Interfaces:**
- Produces: `RIPENING_COPY` and `REVEAL_COPY` string maps + a `featureLabel(id: ProFeatureId): string` helper.

- [ ] **Step 1: REQUIRED — invoke the copy skills FIRST**

Before writing any string, invoke `conversion-psychology` and `humanizer`. Shape every line with them. Honor the no-guilt invariant: ripening copy is encouraging, never "behind"/"locked"/"catch up". Ban-list (project brand voice): no hype, no "unlock your potential", no fake urgency.

- [ ] **Step 2: Write the copy module**

Create `src/components/ripening-pro/copy.ts`. Seed values from the approved mock (refine via the skills):

```ts
import type { ProFeatureId } from '@/src/engine';

export const RIPENING_COPY = {
  eyebrow: 'Pro · ripening',
  pillPrefix: 'Ripens at', // + tier name
  title: 'Your honest range',
  sub: "The band Whenbee is sure you'll land in — once it knows your timing.",
  settling: 'Still settling…',
  footer: 'Keep logging. Each one sharpens the range — nothing to keep up.',
} as const;

export const REVEAL_COPY = {
  eyebrow: 'Pro · ready',
  pill: 'Unlocked',
  headline: 'Whenbee knows you now.',
  sub: 'Your range just tightened. The payoff features have enough to be honest.',
  cta: 'See what Pro can do',
  escape: 'Preview it first',
} as const;

const FEATURE_LABELS: Record<ProFeatureId, string> = {
  'confidence-band': 'Honest range & confidence band',
  'steals-your-time': 'What steals your time',
  'accuracy-correlations': 'When you’re sharpest',
  'context-correlations': 'What moves your accuracy',
  'day-capacity': 'Day-capacity check',
  'honest-week': 'Honest week review',
  'honest-month': 'Honest month review',
};

export function featureLabel(id: ProFeatureId): string {
  return FEATURE_LABELS[id];
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`
```bash
git add src/components/ripening-pro/copy.ts
git commit -m "feat(ripening-pro): user-facing copy (conversion + humanizer pass)"
```

---

### Task 3: `RipeningBand` — settling ↔ sharp band

**Files:**
- Create: `src/components/ripening-pro/RipeningBand.tsx`

**Interfaces:**
- Consumes: `useTheme()`, `useReducedMotion()`.
- Produces: `RipeningBand({ revealed, lowLabel, highLabel }: { revealed: boolean; lowLabel?: string; highLabel?: string })`.

- [ ] **Step 1: REQUIRED — invoke motion skills**

Invoke `creating-reanimated-animations` + `motion-design` before writing motion. Timing/easing come from tokens (`t.motion.honeyFill`, `t.motion.easing.honey`). Entering-only; reduced-motion sets final state instantly.

- [ ] **Step 2: Implement**

Settling state: a sunken well (`colors.surfaceSunken`, `radii.card`) holding a low-opacity ghost segment (reuse the `HonestBandLockedTeaser` ghost geometry — `primarySoft` segment at left 32% width 36%, opacity ~0.55) with a centered `RIPENING_COPY.settling` label (`colors.inkSoft`). NO native blur.
Sharp state: `primaryWash` well, a `primarySoft` range segment (left 30%–right 30%), an indigo dot (`colors.primary`) with a white ring, and `lowLabel`/`highLabel` ticks (`type.caption`, `colors.primary`) above the ends.
Animate the transition when `revealed` flips true: range segment width eases in via `withTiming(..., { duration: t.motion.honeyFill, easing: t.motion.easing.honey })`, dot opacity 0→1. Drive with `useSharedValue` + `.get()/.set()`. Under `useReducedMotion()`, set final values directly.

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/components/ripening-pro/RipeningBand.tsx && npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ripening-pro/RipeningBand.tsx
git commit -m "feat(ripening-pro): settling↔sharp honest band"
```

---

### Task 4: `FeatureReadinessList`

**Files:**
- Create: `src/components/ripening-pro/FeatureReadinessList.tsx`

**Interfaces:**
- Consumes: `featureLabel` (Task 2), `useTheme()`, `ProFeatureId`.
- Produces: `FeatureReadinessList({ items }: { items: { id: ProFeatureId; ready: boolean; waitLabel?: string }[] })`.

- [ ] **Step 1: Implement**

One row per item, `gap: t.space[2.5]`. Ready: a filled amber pip (`colors.accent`) with a white check (svg path), label `type.bodySm` `colors.ink`, trailing `Ready` (`type.caption`, `colors.amberText`, semibold). Ripening: a hollow pip (`surfaceSunken` fill + `1.5` `thick`-style border in a lavender token), label muted (`colors.inkFaint`), trailing `waitLabel` (`colors.inkFaint`). Identical vertical structure per row (CLAUDE.md sibling-row rule); single spacing axis via `gap`.

- [ ] **Step 2: Lint + typecheck + commit**

```bash
npx eslint src/components/ripening-pro/FeatureReadinessList.tsx && npm run typecheck
git add src/components/ripening-pro/FeatureReadinessList.tsx
git commit -m "feat(ripening-pro): per-feature readiness list"
```

---

### Task 5: `RipeningProCard` — the two-state card

**Files:**
- Create: `src/components/ripening-pro/RipeningProCard.tsx`
- Test: `src/components/ripening-pro/__tests__/RipeningProCard.test.tsx`

**Interfaces:**
- Consumes: `RipeningBand`, `FeatureReadinessList`, `RIPENING_COPY`/`REVEAL_COPY`/`featureLabel`, `HoneyBar` (from `@/src/features/reward/HoneyBar` — confirm it is exported/importable; if it lives too deep, lift a shared `HoneyBar` into `src/components/` and re-import in reward, but only if needed), `useTheme()`.
- Produces:
  `RipeningProCard(props: { pitchUnlocked: boolean; honeyPct: number; tier: string; nextTierName: string | null; logsToNext: number; features: { id: ProFeatureId; ready: boolean; waitLabel?: string }[]; onSeePro: () => void; onPreview: () => void })`

- [ ] **Step 1: Write the failing test**

Create `src/components/ripening-pro/__tests__/RipeningProCard.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { RipeningProCard } from '../RipeningProCard';

const base = {
  honeyPct: 30, tier: 'Setting', nextTierName: 'Ripening', logsToNext: 3,
  features: [{ id: 'confidence-band' as const, ready: false, waitLabel: 'soon' }],
  onSeePro: jest.fn(), onPreview: jest.fn(),
};

it('ripening state shows the settling copy and no CTA', () => {
  const { queryByText, getByText } = render(<RipeningProCard {...base} pitchUnlocked={false} />);
  expect(getByText('Still settling…')).toBeTruthy();
  expect(queryByText('See what Pro can do')).toBeNull();
});

it('reveal state shows the headline and fires onSeePro', () => {
  const onSeePro = jest.fn();
  const { getByText } = render(
    <RipeningProCard {...base} pitchUnlocked honeyPct={64} tier="Ripening" onSeePro={onSeePro} />,
  );
  expect(getByText('Whenbee knows you now.')).toBeTruthy();
  fireEvent.press(getByText('See what Pro can do'));
  expect(onSeePro).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/ripening-pro/__tests__/RipeningProCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Card: `colors.surface`, `radii.card`, `padding: t.space[4]`. Header row: amber hex glyph + eyebrow (`type.micro`, `colors.amberText`, uppercase, letterSpacing) on the left; an amber pill (`accentSoft` bg, `amberText` text) on the right — `RIPENING_COPY.pillPrefix + ' ' + nextTierName` when ripening, `REVEAL_COPY.pill + ' ✦'` when revealed.
Ripening (`!pitchUnlocked`): title (`type.heading`) + sub (`type.bodySm`, `inkSoft`); `<RipeningBand revealed={false} />`; `<HoneyBar pct={honeyPct} />` + a meta row (`honeyPct% honey` / `~{logsToNext} more logs`); footer line `RIPENING_COPY.footer` (`inkSoft`). No CTA.
Reveal (`pitchUnlocked`): headline (`type.title`) + sub; `<RipeningBand revealed lowLabel="25m" highLabel="40m" />` (labels are illustrative until wired to the real band — see Task 7 note); `<FeatureReadinessList items={features} />`; then the CTA block — an amber coin-edge button (inner View `colors.accent`, `borderBottomWidth: t.borderWidth.thick`-ish via a darker `accentEdge` edge View; text `colors.onAmber`, `type.button`) calling `onSeePro`, and below it a text link `REVEAL_COPY.escape` (`colors.primary`) calling `onPreview`. Pressable bare wrapper, visuals on inner View.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/ripening-pro/__tests__/RipeningProCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck + commit**

```bash
npx eslint src/components/ripening-pro/RipeningProCard.tsx src/components/ripening-pro/__tests__/RipeningProCard.test.tsx && npm run typecheck
git add src/components/ripening-pro/RipeningProCard.tsx src/components/ripening-pro/__tests__/RipeningProCard.test.tsx
git commit -m "feat(ripening-pro): two-state ripening Pro card"
```

---

### Task 6: Reveal entrance motion

**Files:**
- Modify: `src/components/ripening-pro/RipeningProCard.tsx`

- [ ] **Step 1: REQUIRED — invoke motion skills**

Invoke `creating-reanimated-animations` + `motion-design`. Entering-only; reduced-motion safe; honey is monotonic (no celebratory bounce that implies it can drop).

- [ ] **Step 2: Implement**

When `pitchUnlocked` becomes true (and on first mount already-unlocked), play a calm entrance on the reveal content: fade + small translateY using `FadeInDown`-style ENTERING animation (or a `useSharedValue` opacity/translate eased with `t.motion.easing.honey`, duration `t.motion.honeyFill`). Do NOT add an `exiting` animation to the ripening content (unmount it plainly — Fabric SIGABRT risk). Skip motion under `useReducedMotion()`.

- [ ] **Step 3: Run the card test (no regression) + lint**

Run: `npx jest src/components/ripening-pro/__tests__/RipeningProCard.test.tsx && npx eslint src/components/ripening-pro/RipeningProCard.tsx`
Expected: PASS + clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/ripening-pro/RipeningProCard.tsx
git commit -m "feat(ripening-pro): calm reveal entrance (entering-only, reduced-motion safe)"
```

---

### Task 7: Wire into WhenbeeHub + analytics + routing

**Files:**
- Modify: `src/features/whenbee/WhenbeeHub.tsx`

**Interfaces:**
- Consumes: `vm.proReadiness`, `vm.honeyPct`, `vm.tier`, plus next-tier name + logsToNext (derive via `TIERS`/`logsToNextTier` from `@/src/engine`, mirroring `HoneycombStripPlaceholder`).

- [ ] **Step 1: Implement**

In the `!isPro` branch (currently `ProUpsellCard`, ~line 176): render `<RipeningProCard … />`. Map `features` from `vm.proReadiness.perFeatureReady` to `{ id, ready, waitLabel }` (waitLabel from a small map: day-capacity → "{n} logs away" using `FEATURE_MIN_LOGS - totalLogs`, honest-week → "a week away"; keep it honest, no guilt). Handlers:
- `onSeePro`: `analytics.capture('pro_reveal_tap', { surface: 'whenbee_hub' }); router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pro_reveal' } })`.
- `onPreview`: `analytics.capture('pro_preview_tap', { surface: 'whenbee_hub' }); router.push({ pathname: '/(modals)/paywall', params: { trigger: 'pro_preview' } })`.
Fire a shown event once per state: `analytics.capture(vm.proReadiness.pitchUnlocked ? 'pro_reveal_shown' : 'ripening_pro_shown', { surface: 'whenbee_hub' })` in an effect keyed on `pitchUnlocked`.
Keep `isPro` users on their existing path (they don't see the card). Analytics stays in this feature file (layer rule); the card receives only callbacks.

- [ ] **Step 2: Run the hub test + typecheck + lint**

Run: `npx jest src/features/whenbee && npm run typecheck && npx eslint src/features/whenbee/WhenbeeHub.tsx`
Expected: PASS + clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/whenbee/WhenbeeHub.tsx
git commit -m "feat(whenbee): render ripening-Pro card, gate pitch on readiness"
```

---

### Task 8: Verification gate + device screenshot

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 0 warnings, clean, all green.

- [ ] **Step 2: Render on the simulator/device and screenshot BOTH states**

Use the `whenbee-device` skill (or the sim per CLAUDE.md "Verify UI on the sim"). Drive a fresh account to the ripening state (1–2 logs) and to the reveal state (enough logs to cross `confidence==='setting'`). Capture `xcrun simctl io booted screenshot` for each. Look critically: spacing rhythm, amber-not-indigo CTA, coin-edge depth, ripening reads as "becoming true" not "locked". Fix before reporting done.

- [ ] **Step 3: Commit any visual fixups**

```bash
git add -A && git commit -m "fix(ripening-pro): visual polish from device review"
```

---

## Out of scope (separate follow-ups)

- Applying the ripening/ready pattern to the existing Patterns locked teasers (`StealsYourTimeLocked`, `AccuracyCorrelationsLocked`, `ContextCorrelationsLocked`) and the category-detail `HonestBandLockedTeaser`, so they share the readiness language. Note it; do not build here.
- The "buy early → watch Pro bloom" post-purchase ripening state (Pro users seeing features fill in). Separate plan — needs entitlement + per-feature gating in the Pro surfaces themselves.
- Real band low/high wiring in the reveal card (currently illustrative ticks). Pull from `honestRangeFor` via the hub VM when the band is surfaced on the hub.

## Self-Review

- **Spec coverage:** ripening state (spec §2 "previewed + ripening") → Tasks 3,5; reveal trigger on first `setting` (spec §2) → Tasks 1,7; per-feature readiness (spec §2) → Tasks 4,7; honey bar (spec §1 visible progress) → Task 5; amber CTA + escape hatch + buyable-anytime (spec §2, never-gate-purchase) → Tasks 5,7; motion → Tasks 3,6; copy → Task 2; verification + device shot (visual-approval) → Task 8. Buy-early-bloom + teaser unification explicitly deferred.
- **Placeholder scan:** the only deferred specifics are the band low/high labels (flagged illustrative + Out-of-scope item) and the copy refinement (gated behind the mandatory copy skills in Task 2) — both are directed, not vague.
- **Type consistency:** `RipeningProCard` prop names match between Task 5 definition and Task 7 usage; `proReadiness`/`honeyPct` match between Task 1 (VM) and Task 7; `featureLabel`/`ProFeatureId` consistent across Tasks 2,4,5,7.
