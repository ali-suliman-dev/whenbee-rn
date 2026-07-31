# Ready screen — bottom-section redesign (design spec)

**Date:** 2026-07-16
**Screen:** `src/app/(onboarding)/ready.tsx` — the final onboarding screen ("One tap to start. One tap to ripen.")
**Scope:** Only the section below the "Where you're headed" mastery card — the callout, the nickname affordance, and the footer whisper. The headline, subcopy, mastery card, step-progress, and CTA are unchanged.

## Problem

The bottom third of the Ready screen reads crammed while the middle sits empty. Three elements stack tightly above the CTA:

1. A gray filled callout box (`OnboardingFooterCard` on `surfaceRaised`) — "Empty days are fine. Forgot to time something? Add it in one tap."
2. An always-open bordered nickname `TextInput` — reads like a form field on an activation screen.
3. A centered "Made by one person…" whisper.

Two further issues:

- **Redundancy.** The intro already says "I'll never scold you for a gap." The callout's "Empty days are fine" repeats that no-guilt beat.
- **Weight.** A filled box plus a live input plus a whisper is three heavy things fighting the one job of this screen: tap the CTA and start the first timer.

## Decision

Adopt the **"Bare icon + ghost field"** direction (Option 2 from the 2026-07-16 mock review). It keeps every piece of value, lightens each element, and demotes the nickname from an always-open field to a tap-to-reveal affordance. Founder-approved from the rendered dark-mode mock.

Rejected alternatives (from the same review): a fully de-boxed hairline sign-off (Option 1 — too quiet, loses the icon's meaning), and removing nickname to Settings entirely (Option 3 — kept as the fallback if the ghost field underperforms, not the launch design).

## Design

Everything below the mastery card becomes one bottom-anchored group with even rhythm (`gap: t.space[4]`). The single `flex: 1` spacer between the mastery card and this group stays — the screen is intentionally "content up top, sign-off + CTA anchored bottom." What changes is the weight of that group, not its position.

### 1. Callout — de-boxed

- **Remove** the `OnboardingFooterCard` wrapper (the `surfaceRaised` box) for this usage on the Ready screen.
- Render `ReasonGlyph kind="pulled"` **bare**, inline-left of a single text line: `active={false}`, `ambient`, `size={t.iconSize.md}`. The glyph is already a standalone two-tone SVG (door + exit arrow, indigo/amber) — it needs no disc or box behind it.
- Row layout: `flexDirection: 'row'`, `alignItems: 'flex-start'` (icon aligns to the first text line, optically to the number/cap-height it sits beside), `gap: t.space[3]`.
- Text: `variant="body"`, `color: t.colors.ink`, `flex: 1`.
- **Copy (reordered — concrete action first, reassurance closes):**
  > Forgot to time something? Add it in one tap — empty days are fine.

  This removes the leading-with-reassurance duplication of the intro line and leads with the tangible capability (retro-logging), closing on the no-guilt note.

### 2. Nickname — ghost field (demote-to-tap)

Replaces the always-open `TextInput`. Two states, swapped by local `expanded` state:

**Collapsed (default):**
- A tappable row (`Pressable`, `accessibilityRole="button"`, `accessibilityLabel="Set a nickname"`).
- Visual: `borderWidth: t.borderWidth.chip` (1), `borderStyle: 'dashed'`, `borderColor: t.colors.border`, `borderRadius: t.radii.md`, height `t.size.control.md`, `paddingHorizontal: t.space[3]`, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: t.space[2]`.
- Content: an indigo `＋` mark (`color: t.colors.primary`), label "Set a nickname" (`color: t.colors.inkSoft`, `fontSize: t.fontSize.base`), and a muted "optional" (`color: t.colors.inkFaint`, `fontSize: t.fontSize.xs`) pinned right via `marginLeft: 'auto'`.
- **Follow the RN Pressable gotcha:** the `Pressable` is a bare touch wrapper; the dashed visual lives on an inner `View`. (Function-form styles on `Pressable` silently render nothing under the reactCompiler + nativewind config — see CLAUDE.md.)

**Expanded (after tap):**
- Renders the real `TextInput` in place of the dashed row, `autoFocus` so the keyboard rises immediately. This is a plain expo-router screen, **not** a formSheet, so the Android formSheet-keyboard race does not apply — `autoFocus` is safe here.
- Same `TextInput` styling and props as today: `value`/`onChangeText` bound to `nickname`, `maxLength={MAX_CUSTOM_NAME}`, `placeholder="Your nickname"`, `placeholderTextColor: t.colors.inkFaint`, `returnKeyType="done"`, `accessibilityLabel="Your nickname"`, height `t.size.control.md`, solid `border` (not dashed once it is a live field).
- No collapse control — once expanded it stays. If the user taps it but types nothing, `nickname.trim()` is empty and `saveName(undefined)` runs exactly as today. Name still saves only on the CTA (`timeFirstThing`), unchanged.

The "Anything I should call you? / optional" label header that currently sits above the input is folded into the collapsed row itself ("Set a nickname … optional"), removing one line.

### 3. Whisper — unchanged

The footer stays exactly as-is:
> **Made by one person.** Tell me what to add anytime, it's in Settings.

Centered, `type.caption`, `captionBold` on the lead clause, `inkSoft` body / `ink` bold.

### 4. CTA — unchanged

`AppButton label="Time my first thing →" fullWidth`, default (md) size, `Reveal` index 6.

## Reveal indices

The `Reveal` cascade is preserved 0–6: headline (0), subcopy (1), mastery card (2), callout (3), nickname (4), whisper (5), CTA (6). The callout and nickname keep their indices; only their internals change.

## Tokens

No new tokens required. Everything uses existing tokens:

- Dashed ghost row: `borderWidth.chip`, `borderStyle: 'dashed'` (RN style, not a token), `colors.border`, `radii.md`, `size.control.md`, `space[2]`/`space[3]`.
- Callout row: `iconSize.md`, `space[3]`, `colors.ink`.
- Group rhythm: `space[4]`.

If implementation reveals a needed value that is not a token (e.g. a specific dashed gap), add it to `tokens.ts` rather than inlining — but none is anticipated.

## Component impact

- `src/app/(onboarding)/ready.tsx` — the only screen changed. Inline the de-boxed callout row and the two-state nickname affordance; add local `expanded` state.
- `src/components/OnboardingFooterCard.tsx` — **not deleted.** Check for other consumers first (`grep`). If Ready was its only consumer, it may be removed in a follow-up, but this spec does not require deleting it; it simply stops using it on Ready. Leave the component intact to keep the change surgical.

## Invariants honored

- **No guilt / no streaks.** Copy stays reassuring; nothing added implies shame.
- **Activation-first.** The screen gets lighter and the CTA less contested — nothing added competes with "Time my first thing".
- **Every value from a theme token** (`useTheme()`); no inlined hex/number.
- **One primary CTA per screen** — still exactly one filled indigo button; the nickname `＋` and glyph are accents, not CTAs.
- **Animation rules** — no new entrance motion; the `ReasonGlyph` ambient loop is path/opacity only (already approved). The ghost→input swap is a state change, not a slide-in.

## Testing

- `src/features/onboarding/__tests__/readyScreen.test.tsx` — update for the new structure: assert the callout copy renders, the collapsed "Set a nickname" affordance renders by default, tapping it reveals the `TextInput`, and the entered name still reaches `saveName` on CTA press. Assert `saveName(undefined)` when the field is never expanded / left empty.
- `src/features/onboarding/__tests__/analytics.funnel.test.tsx` — verify the CTA/complete funnel event is unaffected.
- Run the affected suite plus `npm test`, then `npm run lint` and `npm run typecheck`.

## Out of scope

- Deleting `OnboardingFooterCard`.
- Changing the mastery card, headline, subcopy, step progress, or CTA.
- Any change to `saveName` / `complete` / routing behavior.
- Moving nickname to Settings (that is the documented fallback, not this design).
