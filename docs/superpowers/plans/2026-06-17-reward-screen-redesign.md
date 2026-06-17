# Reward Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Reward modal (`src/app/(modals)/reward.tsx`) easier to scan — tighter spacing rhythm, a smaller bee, a demoted reclaim number, and de-AI'd copy — without adding or removing any element.

**Architecture:** Presentation-only. No store/engine/db/logic change. The honest number stays the free-standing hero (Layout A); a three-tier gap system replaces the flat scroll gap; the bee scale-down is reward-scoped via new tokens + a `BeeBurst` prop so hub/paywall/insight bursts are untouched; the reclaim total drops one type-size; six copy strings are reworded.

**Tech Stack:** React Native (Expo SDK 54), expo-router 6, Reanimated 3, Zustand, Jest + @testing-library/react-native. Tokens via `useTheme()` from `src/theme/tokens.ts`; type roles from `src/theme/typography.ts`.

## Global Constraints

- **Tokens only.** Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts` via `useTheme()`. No raw numbers or hex. New value needed → add a token, consume it.
- **No element added or removed.** Placement, size, weight, spacing, and wording only.
- **Product invariants:** no guilt/shame/streak language; honey monotonic; on-device loop untouched.
- **Copy rule:** no em-dashes-as-AI-tell, no twee compound metaphors; keep the honey/nectar brand words.
- **Bee scale-down is reward-scoped.** Never edit the global `burst.stage` / `burst.bee` tokens; hub/paywall/insight bursts must render unchanged.
- **Commits:** Conventional Commits, no AI/co-author attribution.
- **Gate before done:** `npm run lint`, `npm run typecheck`, `npx jest src/features/reward` all green; screenshot-verify on the simulator.

---

### Task 1: Copy rewrites (six strings) + test updates

De-AI the six user-facing strings. Two live in `reward.tsx` (inline), one in `headline.ts`, three in `useReward.ts`. The reward-screen render test asserts four of them, so update those assertions in the same task.

**Files:**
- Modify: `src/features/reward/headline.ts:15` (TIMED_HEADLINES[3])
- Modify: `src/features/reward/useReward.ts:58-59` (RITUAL_DEFAULT, RITUAL_SEAL), `:162` (capEyebrow)
- Modify: `src/app/(modals)/reward.tsx:197` (multiplier line), `:211` (reclaim line)
- Test: `src/features/reward/__tests__/rewardScreen.test.tsx:53,79,81` + add one headline case

**Interfaces:**
- Consumes: nothing new.
- Produces: no API change — string values only. `useReward()` still returns `capEyebrow: string | null`, `ritualLine: string`.

- [ ] **Step 1: Update the asserted copy in the test (make it fail first)**

In `src/features/reward/__tests__/rewardScreen.test.tsx`, change these three assertions:

```typescript
// line ~53 — multiplier sub now reads "runs at"
expect(screen.getByText('Getting ready runs at 2.2×')).toBeOnTheScreen();

// line ~79 — seal eyebrow reworded (article-free, keeps tier name)
expect(screen.getByText('Honest cell sealed')).toBeOnTheScreen();

// line ~81 — seal ritual reworded (no em-dash)
expect(screen.getByText('New honest cell. Nothing to keep up.')).toBeOnTheScreen();
```

And add a new test after the existing "deterministic timed headline" test (~line 68) to cover the reworded headline at index 3:

```typescript
it('renders the reworded nectar headline at rotation index 3', () => {
  useCalibrationStore.setState({ logs: 3 });
  useRewardStore.getState().setReward({
    actualMin: 10,
    guessMin: 10,
    category: 'email',
    label: null,
    result: baseResult,
  });
  render(<Reward />);
  // logs % 4 === 3 → fourth headline (the de-twee'd one).
  expect(screen.getByText("That's one more, logged.")).toBeOnTheScreen();
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx jest src/features/reward/__tests__/rewardScreen.test.tsx`
Expected: FAIL — old strings ("Getting ready now reads 2.2×", "Honey ripened · this cell's now Honest", the seal ritual) still rendered; new headline test can't find "That's one more, logged."

- [ ] **Step 3: Reword the headline**

In `src/features/reward/headline.ts`, replace the fourth entry of `TIMED_HEADLINES`:

```typescript
export const TIMED_HEADLINES = [
  'Logged. Nice one.',
  "That's the honest number.",
  'Caught it. Good.',
  "That's one more, logged.",
] as const;
```

- [ ] **Step 4: Reword the ritual lines and the seal eyebrow**

In `src/features/reward/useReward.ts`, replace the two ritual constants:

```typescript
const RITUAL_DEFAULT = 'One honest log a day. No streak to keep.';
const RITUAL_SEAL = 'New honest cell. Nothing to keep up.';
```

And the capEyebrow expression at line ~162:

```typescript
capEyebrow: result.leveledUp ? `${result.tierAfter} cell sealed` : null,
```

- [ ] **Step 5: Reword the two inline strings in reward.tsx**

In `src/app/(modals)/reward.tsx`, the multiplier line (~197):

```tsx
<Text style={subText}>
  {r.categoryLabel} runs at {r.multiplier.toFixed(1)}×
</Text>
```

The reclaim line (~211):

```tsx
<Text style={subText}>
  Your honest number was {r.reclaimDeltaMin} min closer.
</Text>
```

- [ ] **Step 6: Run the test — verify it passes**

Run: `npx jest src/features/reward/__tests__/rewardScreen.test.tsx`
Expected: PASS (all cases, including the new headline test).

- [ ] **Step 7: Lint the touched files**

Run: `npx eslint src/features/reward/headline.ts src/features/reward/useReward.ts "src/app/(modals)/reward.tsx" src/features/reward/__tests__/rewardScreen.test.tsx`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/reward/headline.ts src/features/reward/useReward.ts "src/app/(modals)/reward.tsx" src/features/reward/__tests__/rewardScreen.test.tsx
git commit -m "feat: de-AI the Reward screen copy (headline, eyebrow, ritual, sublines)"
```

---

### Task 2: Demote the reclaim total's size

The lifetime reclaim total in `ReclaimDeposit` is styled `type.multiplier` (subtitle-sized, bold) — that is the `20m` competing with the `35 min` hero. Drop it to `type.bodyLg` so the size ladder reads `35 min` > `43%` > reclaim total. Style-only; no behavior, motion, or a11y change.

**Files:**
- Modify: `src/features/reward/ReclaimDeposit.tsx` (`totalStyle`, ~line 133)
- Test: `src/features/reward/__tests__/rewardScreen.test.tsx` (existing reclaim cases must stay green)

**Interfaces:**
- Consumes: `type.bodyLg` from `src/theme/typography.ts` (`{ fontFamily, fontSize, lineHeight }`).
- Produces: no prop/API change.

- [ ] **Step 1: Change the total's type role**

In `src/features/reward/ReclaimDeposit.tsx`, the `totalStyle` block:

```tsx
const totalStyle: TextStyle = {
  ...(type.bodyLg as unknown as TextStyle),
  color: t.colors.amberText,
  padding: 0,
};
```

(Only the spread role changes: `type.multiplier` → `type.bodyLg`. `color` and `padding` stay.)

- [ ] **Step 2: Run the reward tests — verify still green**

Run: `npx jest src/features/reward/__tests__/rewardScreen.test.tsx`
Expected: PASS. The reclaim beat's text/label assertions ("+15m reclaimed", "Reclaimed 15 minutes, 3h 20m banked") are size-independent, so they still pass.

- [ ] **Step 3: Lint**

Run: `npx eslint src/features/reward/ReclaimDeposit.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/reward/ReclaimDeposit.tsx
git commit -m "feat: demote the reclaim total size so it trails the honest number"
```

---

### Task 3: Reward-scoped bee scale-down

Add reward-only burst sizes and a `stageSize` prop to `BeeBurst` so the reward bee shrinks (stage 240→190, bee 168→120) and the coin re-anchors to the bee's shoulder at the smaller stage. Global tokens stay; hub/paywall/insight bursts pass no override and render unchanged.

**Files:**
- Modify: `src/theme/tokens.ts` (`burst` group, ~line 234-241)
- Modify: `src/components/bee/BeeBurst.tsx` (add `stageSize` prop; make `coinSlot` stage-relative)
- Modify: `src/features/reward/RewardBee.tsx` (pass reward sizes)
- Test: `src/features/reward/__tests__/rewardScreen.test.tsx` (render must stay green — no crash, bee/coin still present)

**Interfaces:**
- Consumes: `t.burst.stageReward` (number, 190), `t.burst.beeReward` (number, 120).
- Produces: `BeeBurst` gains an optional prop — new signature:
  `BeeBurst({ variant?: BeeBurstVariant; beeSize?: number; stageSize?: number })`.
  Default `stageSize = t.burst.stage` so all existing callers are unaffected.
  `RewardBee({ sealed?: boolean })` is unchanged externally.

- [ ] **Step 1: Add the reward-scoped tokens**

In `src/theme/tokens.ts`, inside the `burst` object, add two entries next to `stage`/`bee` (keep `stage: 240` and `bee: 168` exactly as they are):

```typescript
  burst: {
    // ...existing comment + fields...
    stage: 240, // ray-burst stage edge (square)
    bee: 168, // mascot size inside a hero burst (fits the 240 stage → no layout push)
    stageReward: 190, // reward-modal stage — a calmer crest, not a hero (reward only)
    beeReward: 120, // reward-modal mascot size inside the 190 stage (reward only)
    beeFloat: 5, // ± vertical bee drift (calm ambient)
    // ...rest unchanged...
  },
```

- [ ] **Step 2: Accept `stageSize` and make the coin slot stage-relative in BeeBurst**

In `src/components/bee/BeeBurst.tsx`, extend the props and derive the stage + coin position from it. Replace the component signature/opening and the `coinSlot` constant:

```tsx
export function BeeBurst({
  variant = 'reward',
  beeSize,
  stageSize,
}: {
  variant?: BeeBurstVariant;
  beeSize?: number;
  stageSize?: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();

  const stage = stageSize ?? t.burst.stage;
  const bee = beeSize ?? t.burst.bee;
  const spec = BADGE[variant];
```

Then the coin slot — make `top`/`right` scale with the stage so the coin rides the bee's shoulder at any size (the old `top: space[10]` / `right: space[6]` literals were tuned for 240):

```tsx
  // Coin rides the bee's upper-right shoulder. Anchored as a fraction of the
  // stage so it tracks the bee at any stageSize (no float/clip when shrunk).
  const coinSlot: ViewStyle = {
    position: 'absolute',
    top: stage * 0.16,
    right: stage * 0.1,
  };
```

(Everything else in the file — RayBurst, the float worklet, BeeMascot, CoinBadge — stays as is; they already read `stage`/`bee` locals.)

- [ ] **Step 3: Pass the reward sizes from RewardBee**

In `src/features/reward/RewardBee.tsx`, read the theme and forward the reward-scoped sizes:

```tsx
import { BeeBurst } from '@/src/components/bee/BeeBurst';
import { useTheme } from '@/src/theme/useTheme';

// ──────────────────────────────────────────────────────────────────────────────
// RewardBee — the Reward-moment crest. A reward-scoped (smaller) BeeBurst so the
// bee is a calm intro, not the hero. Normal log shows "+1 nectar"; a seal swaps
// to the ▲ upgrade coin. Global burst sizes (hub/paywall) are untouched.
// ──────────────────────────────────────────────────────────────────────────────

export function RewardBee({ sealed = false }: { sealed?: boolean }) {
  const t = useTheme();
  return (
    <BeeBurst
      variant={sealed ? 'upgrade' : 'reward'}
      stageSize={t.burst.stageReward}
      beeSize={t.burst.beeReward}
    />
  );
}
```

- [ ] **Step 4: Run reward + bee tests — verify green**

Run: `npx jest src/features/reward src/components/bee`
Expected: PASS. Reward render still mounts (bee + coin present, no crash). If no `src/components/bee` tests exist, the path is simply skipped — the reward suite is the gate.

- [ ] **Step 5: Typecheck (new prop is sound) + lint**

Run: `npm run typecheck && npx eslint src/theme/tokens.ts src/components/bee/BeeBurst.tsx src/features/reward/RewardBee.tsx`
Expected: no type errors (e.g. confirms `stageReward`/`beeReward` exist on the `burst` token type), no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/theme/tokens.ts src/components/bee/BeeBurst.tsx src/features/reward/RewardBee.tsx
git commit -m "feat: scope the Reward bee smaller via reward-only burst sizes"
```

---

### Task 4: Three-tier spacing rhythm + optional-tail grouping

Replace the flat `scrollContent.gap: space[4]` with deliberate gaps: tight within a group, wide (`space[6]`) between the four major zones, and `space[3]` between the reason and energy chip groups so the tail reads as optional tags, not two stacked forms. Style-only; all elements stay in the same order.

**Files:**
- Modify: `src/app/(modals)/reward.tsx` (`scrollContent`, zone wrappers, payoff card gap, tail grouping)
- Test: `src/features/reward/__tests__/rewardScreen.test.tsx` (full suite stays green)

**Interfaces:**
- Consumes: `t.space[2]`, `t.space[3]`, `t.space[6]` from tokens; no new tokens.
- Produces: no API change.

- [ ] **Step 1: Switch the scroll container to the wide zone gap**

In `src/app/(modals)/reward.tsx`, change `scrollContent` so the container gap becomes the wide between-zone tier (was `space[4]`):

```tsx
const scrollContent: ViewStyle = {
  flexGrow: 1,
  gap: t.space[6], // wide tier — separates the four major zones
  paddingTop: t.space[2],
};
```

- [ ] **Step 2: Tighten the intro cluster gap**

The Zone 1 wrapper currently uses `gap: t.space[3]`. Tighten it so eyebrow↔bee↔headline read as one cluster:

```tsx
{/* Zone 1 — emotional hit */}
<View style={{ alignItems: 'center', gap: t.space[2] }}>
  {r.capEyebrow ? <Text style={capEyebrow}>{r.capEyebrow}</Text> : null}
  <RewardBee sealed={r.sealed} />
  <Text style={headlineText}>{r.headline}</Text>
</View>
```

(Zone 2's `heroBlock` already uses `gap: t.space[1.5]` — leave it; it is the tight tier.)

- [ ] **Step 3: Set the payoff card to the medium internal gap**

`payoffCard` currently uses `gap: t.space[2.5]`. Set it to the medium tier for a consistent internal rhythm:

```tsx
const payoffCard: ViewStyle = {
  backgroundColor: t.colors.surfaceRaised,
  borderRadius: t.radii.card,
  padding: t.space[4],
  gap: t.space[3], // medium tier — card internals
};
```

- [ ] **Step 4: Group the optional tail (reason + energy) as one block**

The reason chips and energy chips are currently two direct scroll children, so the wide `space[6]` container gap falls between them — that is what makes them read as two separate forms. Wrap both in one `View` with the medium `space[3]` gap, so the pair reads as a single optional-tags zone (one wide gap above, one below). Replace the two sibling blocks (the `ReasonChips` block and the `EnergyChips` block) with:

```tsx
{/* Zone 4 — the optional tail: where'd the time go + energy. Grouped so the
    two chip rows read as one optional-tags block, not two stacked forms. Pure
    side-channel data — never blocks the exit, never touches the model. */}
{r.eventId ? (
  <View style={{ gap: t.space[3] }}>
    {r.reasonDirection ? (
      <ReasonChips eventId={r.eventId} direction={r.reasonDirection} category={r.category} />
    ) : null}
    <EnergyChips eventId={r.eventId} />
  </View>
) : null}
```

(The CTA `ctaBlock` keeps its `marginTop: 'auto'` and its own paddings — unchanged. It still rides the bottom of the flow.)

- [ ] **Step 5: Run the full reward suite — verify green**

Run: `npx jest src/features/reward/__tests__/rewardScreen.test.tsx`
Expected: PASS. Grouping is presentation-only — every text/label the tests query is unchanged (reason rows, exits, reclaim, fallback all still render in the same order).

- [ ] **Step 6: Lint**

Run: `npx eslint "src/app/(modals)/reward.tsx"`
Expected: no errors.

- [ ] **Step 7: Screenshot-verify on the simulator**

Build/run (`npm run ios`), trigger a log to reach the Reward modal, capture `xcrun simctl io booted screenshot /tmp/reward.png`, and look critically:
- Bee is a compact crest; `+1 nectar` coin sits on the shoulder, clips no ray.
- Size ladder reads `35 min` > `43%` > reclaim total.
- Four zones read as grouped (wide air between intro / hero / card / tail), not an evenly-spaced list.
- Reason + energy read as one optional block above the CTA.
- New copy throughout; no em-dashes, no clipped text.

Fix any spacing/alignment issue before committing.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(modals)/reward.tsx"
git commit -m "feat: regroup the Reward layout with a three-tier spacing rhythm"
```

---

## Final verification

- [ ] `npm run lint` — 0 warnings.
- [ ] `npm run typecheck` — clean.
- [ ] `npx jest src/features/reward` — green.
- [ ] Hub + paywall bursts spot-checked unchanged (no reward override leaked into global tokens).

## Self-review notes

- **Spec coverage:** gap system → Task 4; bee scale-down (reward-scoped) → Task 3; reclaim demotion → Task 2; six copy rewrites → Task 1; testing requirement → per-task + final. All spec sections mapped.
- **Type consistency:** `BeeBurst` prop named `stageSize` in Task 3 and consumed only there; `RewardBee` external signature unchanged; tokens `stageReward`/`beeReward` defined in Task 3 Step 1 and consumed in Steps 2-3.
- **No global-token leak:** Task 3 explicitly keeps `stage`/`bee` and adds parallel reward-only fields; final check spot-checks hub/paywall.
