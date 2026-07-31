# Ready-screen bottom-section redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De-crowd the final onboarding screen (`ready.tsx`) — de-box the callout, demote the nickname to a tap-to-reveal ghost field, keep the whisper.

**Architecture:** Single-screen edit. Replace the boxed `OnboardingFooterCard` callout with a bare `ReasonGlyph` + text row, and replace the always-open `TextInput` with a collapsed dashed "Set a nickname" affordance that swaps to the real input on tap via local `expanded` state. No new components, no new tokens, no behavior change to save/complete/routing.

**Tech Stack:** React Native, Expo, expo-router, TypeScript, Reanimated (existing `ReasonGlyph`), `@testing-library/react-native`.

## Global Constraints

- Every spacing/size/font/color value comes from a theme token via `useTheme()` — never inline a raw number or hex.
- RN Pressable gotcha: `Pressable` stays a bare touch wrapper; all visual style goes on an inner `View`. No function-form `style={({pressed}) => …}`.
- One primary CTA per screen — exactly one filled indigo button; the glyph and `＋` are accents, not CTAs.
- No new entrance motion; keep the `Reveal` cascade indices 0–6 unchanged.
- Copy is fixed verbatim (below) — no guilt/shame language.
- Run `npm run lint` (0 warnings) + `npm run typecheck` + affected jest suite before each commit; `npm test` before finishing.
- Never delete `OnboardingFooterCard` in this plan.

---

### Task 1: De-box the callout

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx` (callout block ~lines 103–109; imports)
- Test: `src/features/onboarding/__tests__/readyScreen.test.tsx`

**Interfaces:**
- Consumes: `ReasonGlyph` from `@/src/features/reward/ReasonGlyph` (already imported) — signature `ReasonGlyph({ kind, active, size?, ambient? })`, `kind="pulled"`.
- Produces: a de-boxed callout row rendering text matching `/empty days are fine/i` and `/Add it in one tap/i`.

- [ ] **Step 1: Update the render test for the new callout copy**

In `readyScreen.test.tsx`, the existing test `'ready shows trail, legend, promise, nickname field, CTA'` already asserts `/Empty days are fine/i`. Add an assertion for the reordered copy right after that line:

```tsx
expect(screen.getByText(/Forgot to time something\? Add it in one tap/i)).toBeTruthy();
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/onboarding/__tests__/readyScreen.test.tsx -t "ready shows trail"`
Expected: FAIL — current copy is "Empty days are fine. Forgot to time something? Add it in one tap." (reassurance leads), so the reordered regex does not match yet.

- [ ] **Step 3: De-box the callout in `ready.tsx`**

Replace the callout `Reveal` block (currently):

```tsx
<Reveal index={3}>
  <OnboardingFooterCard
    glyph={<ReasonGlyph kind="pulled" active={false} ambient size={t.iconSize.lg} />}
  >
    Empty days are fine. Forgot to time something? Add it in one tap.
  </OnboardingFooterCard>
</Reveal>
```

with:

```tsx
<Reveal index={3}>
  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space[3] }}>
    <ReasonGlyph kind="pulled" active={false} ambient size={t.iconSize.md} />
    <AppText variant="body" style={{ flex: 1, color: t.colors.ink }}>
      Forgot to time something? Add it in one tap — empty days are fine.
    </AppText>
  </View>
</Reveal>
```

Then remove the now-unused import:

```tsx
import { OnboardingFooterCard } from '@/src/components/OnboardingFooterCard';
```

(`View` and `AppText` are already imported.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/onboarding/__tests__/readyScreen.test.tsx -t "ready shows trail"`
Expected: PASS.

- [ ] **Step 5: Lint + typecheck the file**

Run: `npx eslint src/app/(onboarding)/ready.tsx` then `npm run typecheck`
Expected: no errors, no unused-import warning for `OnboardingFooterCard`.

- [ ] **Step 6: Commit**

```bash
git add src/app/(onboarding)/ready.tsx src/features/onboarding/__tests__/readyScreen.test.tsx
git commit -m "refactor: de-box Ready-screen callout into a bare glyph row"
```

---

### Task 2: Demote nickname to a tap-to-reveal ghost field

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx` (nickname block ~lines 111–150; add `Pressable` import + `expanded` state)
- Test: `src/features/onboarding/__tests__/readyScreen.test.tsx`

**Interfaces:**
- Consumes: `useState` (already imported), `Pressable` (add to the `react-native` import), `MAX_CUSTOM_NAME` (already imported), `nickname`/`setNickname` (already in scope).
- Produces: a collapsed affordance with `accessibilityLabel="Set a nickname"` that, on press, renders the real `TextInput` with `accessibilityLabel="Your nickname"`. Name save on CTA is unchanged.

- [ ] **Step 1: Write the failing tests**

In `readyScreen.test.tsx`:

(a) In `'ready shows trail, legend, promise, nickname field, CTA'`, replace the two nickname lines:

```tsx
// remove:
expect(screen.getByText(/Anything I should call you/i)).toBeTruthy();
expect(screen.getByLabelText('Your nickname')).toBeTruthy();
// add:
expect(screen.getByLabelText('Set a nickname')).toBeTruthy();
expect(screen.queryByLabelText('Your nickname')).toBeNull();
```

(b) Add a new test:

```tsx
test('tapping “Set a nickname” reveals the input', () => {
  render(<Ready />);
  expect(screen.queryByLabelText('Your nickname')).toBeNull();
  fireEvent.press(screen.getByLabelText('Set a nickname'));
  expect(screen.getByLabelText('Your nickname')).toBeTruthy();
});
```

(c) In `'CTA with a nickname saves it before completing'`, expand before typing — insert as the first line of the test body:

```tsx
fireEvent.press(screen.getByLabelText('Set a nickname'));
```

(before the existing `fireEvent.changeText(screen.getByLabelText('Your nickname'), 'Jordan');`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/onboarding/__tests__/readyScreen.test.tsx`
Expected: FAIL — no element labeled "Set a nickname" yet; the always-open input still renders.

- [ ] **Step 3: Add `Pressable` to the imports and `expanded` state**

In `ready.tsx`, extend the `react-native` import to include `Pressable`:

```tsx
import { View, TextInput, KeyboardAvoidingView, Platform, Pressable, type TextStyle } from 'react-native';
```

Add local state next to `nickname`:

```tsx
const [nickname, setNickname] = useState('');
const [expanded, setExpanded] = useState(false);
```

- [ ] **Step 4: Replace the nickname block with the two-state affordance**

Replace the current nickname `Reveal` block (the `Reveal index={4}` wrapping the label row + `TextInput`) with:

```tsx
{/* Optional nickname — demoted to a tap. Collapsed ghost row → real input. */}
<Reveal index={4}>
  {expanded ? (
    <TextInput
      value={nickname}
      onChangeText={setNickname}
      autoFocus
      placeholder="Your nickname"
      placeholderTextColor={t.colors.inkFaint}
      maxLength={MAX_CUSTOM_NAME}
      returnKeyType="done"
      accessibilityLabel="Your nickname"
      style={{
        height: t.size.control.md,
        fontSize: t.fontSize.base,
        color: t.colors.ink,
        borderWidth: t.borderWidth.chip,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        paddingHorizontal: t.space[3],
      }}
    />
  ) : (
    <Pressable
      onPress={() => setExpanded(true)}
      accessibilityRole="button"
      accessibilityLabel="Set a nickname"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space[2],
          height: t.size.control.md,
          paddingHorizontal: t.space[3],
          borderWidth: t.borderWidth.chip,
          borderStyle: 'dashed',
          borderColor: t.colors.border,
          borderRadius: t.radii.md,
        }}
      >
        <AppText style={{ fontSize: t.fontSize.md, color: t.colors.primary }}>＋</AppText>
        <AppText style={{ fontSize: t.fontSize.base, color: t.colors.inkSoft }}>Set a nickname</AppText>
        <AppText style={{ fontSize: t.fontSize.xs, color: t.colors.inkFaint, marginLeft: 'auto' }}>
          optional
        </AppText>
      </View>
    </Pressable>
  )}
</Reveal>
```

Notes: `borderWidth.chip` = 1; `borderStyle: 'dashed'` is a plain RN style (not a token). The `Pressable` carries only `onPress`/a11y; the dashed visual lives on the inner `View` (RN Pressable gotcha). This is a plain expo-router screen (not a formSheet), so `autoFocus` is safe.

- [ ] **Step 5: Run the full Ready suite to verify it passes**

Run: `npx jest src/features/onboarding/__tests__/readyScreen.test.tsx`
Expected: PASS (all tests, including the new reveal test and the expand-then-save test).

- [ ] **Step 6: Lint + typecheck**

Run: `npx eslint src/app/(onboarding)/ready.tsx` then `npm run typecheck`
Expected: no errors, no unused vars.

- [ ] **Step 7: Commit**

```bash
git add src/app/(onboarding)/ready.tsx src/features/onboarding/__tests__/readyScreen.test.tsx
git commit -m "feat: demote Ready-screen nickname to a tap-to-reveal ghost field"
```

---

### Task 3: Verify (full suite + funnel + device)

**Files:**
- Check only: `src/features/onboarding/__tests__/analytics.funnel.test.tsx`, other `OnboardingFooterCard` consumers.

**Interfaces:**
- Consumes: nothing new.
- Produces: a verified, green build.

- [ ] **Step 1: Confirm `OnboardingFooterCard` still has consumers (do NOT delete it)**

Run: `grep -rn "OnboardingFooterCard" src`
Expected: at minimum its own definition file. If Ready was the only consumer, leave the component in place anyway (out of scope) — just note it in the PR body.

- [ ] **Step 2: Run the funnel test**

Run: `npx jest src/features/onboarding/__tests__/analytics.funnel.test.tsx`
Expected: PASS — the CTA → complete funnel is untouched.

- [ ] **Step 3: Run the full suite + lint + typecheck**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all PASS, 0 lint warnings, 0 type errors.

- [ ] **Step 4: Device/sim visual check**

Deep-link to the screen and screenshot:

```bash
xcrun simctl openurl booted "whenbee:///(onboarding)/ready"
xcrun simctl io booted screenshot /tmp/ready.png
```

Open `/tmp/ready.png` and confirm against the spec: de-boxed callout row (bare glyph + one line, action-first copy), a dashed "Set a nickname · optional" row, the whisper, and the CTA — no gray callout box, even bottom rhythm, nothing cramped. Tap the dashed row on the sim manually to confirm it swaps to the input and the keyboard rises. (Deep-link cannot trigger taps.)

- [ ] **Step 5: No commit**

Verification only — nothing to commit unless a screenshot revealed a spacing fix (then commit that fix with a `fix:` message).

---

## Self-Review

**Spec coverage:**
- §Design 1 (callout de-boxed, reordered copy) → Task 1. ✓
- §Design 2 (nickname ghost field, collapsed/expanded, folded "optional" label, save-on-CTA unchanged) → Task 2. ✓
- §Design 3 (whisper unchanged) → untouched, no task needed. ✓
- §Design 4 (CTA unchanged) → untouched. ✓
- §Reveal indices 0–6 preserved → callout stays index 3, nickname stays index 4. ✓
- §Tokens (no new tokens) → all values from existing tokens. ✓
- §Component impact (don't delete `OnboardingFooterCard`, grep consumers) → Task 3 Step 1. ✓
- §Testing (readyScreen + funnel + full suite + lint + typecheck) → Tasks 1–3. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows the full code. ✓

**Type consistency:** `accessibilityLabel="Set a nickname"` (collapsed) and `"Your nickname"` (expanded) used identically across Task 2 render code and its tests; `expanded`/`setExpanded` and `nickname`/`setNickname` consistent; `t.borderWidth.chip`, `t.radii.md`, `t.size.control.md`, `t.iconSize.md` all match tokens.ts. ✓
