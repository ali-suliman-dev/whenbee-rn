# FocusCard + Task rows redesign (design spec)

> **Status:** Approved in brainstorming (visual companion, 2026-06-17). Ready for an implementation plan.
> **Scope:** Redesign Today's **FocusCard** (the "next task" centerpiece) and **TaskRow** (Up next / Done lists), plus bring **RunningFocusCard** into visual consistency so the start swap doesn't jump. Pure presentation — no engine/data/store changes.
> **Out of scope:** the HUD, empty states, timer modal internals, the engine. Those shipped in the prior Today redesign.

---

## 1. The problems (from the live screens)

- **FocusCard has three indigo elements fighting** (play coin + eyebrow dot + "guessed" label) so nothing wins; the design system wants exactly one filled indigo per screen. The honest number doesn't read as the hero. The `focal` indigo top border reads heavy.
- **TaskRow gives every row a filled play badge**, so nothing stands out as "the one to start" — and it competes with the FocusCard. Rows feel cramped. The **Done row's strikethrough reads as a scold** (brand: no guilt). The estimate is the same muted gray as the category, so it's buried.

---

## 2. FocusCard — new design ("B")

A calm card whose hero is the honest number, with one explicit Start button.

**Surface:** `Card` raised tone (surfaceRaised + soft shadow). **Remove the `focal` indigo top border** — flat surface reads cleaner. (See §5 for the shared Card change.)

**Header row** (`flexDirection: row`, `justifyContent: space-between`, **`alignItems: flex-end`** so the title block's baseline and the number's bottom align):
- Left: eyebrow `Next · {CATEGORY}` (muted, no indigo dot), then the task title (ink, one line).
- Right: the honest number via `HonestNumber` — value `~{honestMinutes}`, **size 24px** (down from the current 30px `big`; use the existing 24px step / `xl` is 40 so this needs a 24 size — see §5 tokens), unit `min` muted.

**Gap bar:** the existing `GapLine` (indigo guess segment + amber learned-extra), unchanged.

**Context line** (`flexDirection: row`, `justifyContent: space-between`, `alignItems: center`, just under the bar):
- Left: `guessed {guess} · +{delta} learned` — "+{delta} learned" in amber (`amberText`), the rest muted. (Only show the "+{delta} learned" clause when `delta > 0`, matching today's gap logic; otherwise just `guessed {guess}`.)
- Right: the **finish projection** `done {clock}` (e.g. `done 4:11pm`) in ink, mono/tabular. This is `projectedFinish(now, honestMinutes)` → `formatClock`, passed in as a prop (the card stays clock-free; the screen/hook computes it — `useToday` already calls `projectedFinish`).

**Start button:** a full-width indigo `AppButton` labelled `Start` with a leading play glyph. This replaces the old left play coin — the button is now the single indigo fill + the Fitts-friendly primary target. The whole card remains pressable as a secondary path (tap card = start), but the button is the obvious affordance.

**OptimismNudge:** preserve the existing conditional `OptimismNudge` (shown when `basis === 'personal'` and honest > guess), appended below — unchanged.

**Accessibility:** card label unchanged in spirit: `{title}, {categoryLabel}. Plan for about {honest} minutes, you guessed {guess}, done by {clock}. Tap to start.` No em dashes in any label.

## 3. RunningFocusCard — consistency pass

`RunningFocusCard` mirrors FocusCard's skeleton so the live card swaps in with zero layout jump. Apply the same surface change (drop the indigo top border) and keep the header layout aligned with the new FocusCard (eyebrow + title left, elapsed clock right at the matching size/position). It keeps its live elapsed clock, the `GapLine` with the live marker, and the existing **Stop & log** path. No new behavior — just keep it visually in lockstep with the redesigned FocusCard so nothing jumps on start/stop.

## 4. TaskRow — new design ("B")

Uniform, quiet rows so the FocusCard stays the sole stand-out. One shared component, two states.

**Shared:** `flexDirection: row`, `alignItems: center`, surface, `radii.card`, comfortable padding, `minHeight` ≥ a 44pt+ target (reuse `size.control.lg`). `position: relative`.

**Queued (Up next) — interactive:**
- **Interactive edge marker:** a thin **indigo** (`colors.primary`) vertical bar pinned to the left edge (absolutely positioned, vertically centered, rounded outer corners). It is a *semantic* signifier meaning "you can start this" — one consistent color across all actionable rows (Gestalt similarity + Nielsen consistency). Row gets left padding to clear it. **No leading play badge. No trailing chevron.**
- Center: title (ink, medium) + category sub-line (muted).
- Right: the estimate as its **own element**, `alignSelf: flex-end` (drops to the row's bottom edge, baseline-level with the category line): `~{honestMin}` in **ink, bold, tabular, same body size** (clarity via contrast, not size) + `min` muted.
- Whole row is the `Pressable`; press feedback = the existing opacity/scale dip.

**Done — non-interactive:**
- **No** edge marker. Leading success **check** badge (existing `successSoft` circle).
- Center: title in **muted ink with NO strikethrough** (the strikethrough is removed — the check + dimming already say "done"; strikethrough reads as a scold). Category sub-line muted.
- Right: `took {actualMin} min`, `alignSelf: flex-end` — "took"/"min" muted, `{actualMin}` in ink bold tabular.
- Row dimmed (`opacity ~0.8`), not pressable.

## 5. Shared changes & tokens

- **`Card` `focal` tone:** the redesign drops the indigo top edge for the FocusCard. Either (a) stop using `tone="focal"` on FocusCard/RunningFocusCard and use `tone="raised"`, or (b) change the `focal` tone to no longer draw `borderTopWidth`. **Decision: (a)** — switch FocusCard + RunningFocusCard to `tone="raised"`, leave the `Card` `focal` tone in place for any other caller. No global Card edit needed; lower blast radius.
- **24px honest-number size:** `HonestNumber` currently offers `inline`(22)/`big`(30)/`xl`(40). The FocusCard wants 24. Add a typography role for 24px tabular Inter-Bold (e.g. extend the type scale) and a matching `HonestNumber` size, OR pass an explicit size override. **Decision:** add a `'md'` size to `HonestNumber` backed by a 24px tabular role token in `typography.ts` (no inline number).
- **Interactive edge geometry:** add a token for the marker (width ~3, height ~20, radius) under a sensible group in `tokens.ts` (e.g. `tokens.row = { edgeW, edgeH }`) — no inline numbers. Color = `colors.primary`.
- All other values come from existing tokens (`space`, `radii`, `colors`, `progress`, `motion`).

## 6. Invariants honored

Amber-never-red (the learned-extra + gap stay amber; nothing red); no strikethrough/scold on Done; one filled indigo per screen (the Start button; rows use a thin indigo *edge*, not a fill); honest number is the hero; copy carries no em dashes and no guilt language; all values token-sourced; reanimated press feedback on an inner `Animated.View`, never function-form `style` on `Pressable`.

## 7. Components & files

- **Modify** `src/features/today/FocusCard.tsx` — new layout (raised tone, flex-end header, 24px number, context line with finish projection, Start button, keep OptimismNudge). New prop: `finishClock: string`.
- **Modify** `src/features/today/RunningFocusCard.tsx` — raised tone + header alignment to match (consistency).
- **Modify** `src/features/today/TaskRow.tsx` — interactive edge marker (queued), bottom-aligned ink estimate, remove chevron, remove done strikethrough, "took N min" receipt.
- **Modify** `src/features/today/useToday.ts` (or the screen) — provide `finishClock` for the focus task via `projectedFinish` + `formatClock` (already imported in the hook).
- **Modify** `src/components/HonestNumber.tsx` — add `'md'` (24px) size.
- **Modify** `src/theme/typography.ts` + `src/theme/tokens.ts` — 24px role; interactive-edge geometry token.
- **Tests:** extend `src/features/today/__tests__/todayScreen.test.tsx` (focus card shows `~30`, `done 4:11pm`, guess/learned; up-next row shows ink estimate; done row shows `took 35 min`, NO strikethrough, NO chevron). Component tests for `TaskRow` (queued vs done) and `HonestNumber` `'md'`.

## 8. Testing specifics

- FocusCard: renders `~30`, `min`, `guessed 15`, `+15 learned` (amber), `done 4:11pm`, and a `Start` button; pressing Start / the card fires `onStart`.
- TaskRow queued: renders the title, category, `~25` + `min`, fires `onPress`; renders the interactive edge marker (testID); no chevron icon present.
- TaskRow done: renders `took`, `35`, `min`; title has NO `textDecorationLine: line-through`; not pressable; no edge marker.
- `HonestNumber` `'md'` renders at the 24px role.
- Copy assertions: no em dash, no banned strings.

## 9. Non-goals
- No change to the HUD, empty states, or timer modal.
- No new engine/data. `finishClock` reuses existing `projectedFinish`/`formatClock`.
- Category-color system is explicitly NOT introduced (the edge marker is a single semantic indigo, not per-category).
