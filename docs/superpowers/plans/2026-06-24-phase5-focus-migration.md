# Planning Expansion — Phase 5: Focus Migration

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 4** (`feat/planning-timeline`, PR #51). The Timeline focus band + Plan-my-day focus preference already shipped in Phase 4. This phase moves the rest: the List one-line insight + the curve/detail into Patterns + removing the now-redundant Plan-tab Focus segment.

**Goal:** Finish dissolving "Focus" into the day surface. The Today **List** shows a quiet one-line focus insight ("Sharpest 9–11am — your window for hard tasks"); the focus **curve + window + maturity** detail moves to **Patterns**; the **Plan tab loses its Focus segment** (curve lives in Patterns; the task-packing is subsumed by the Phase-4 Timeline). Engine (`useLearnedFocusWindow`, `focusWindowLearn`) and the existing focus components are reused, not rewritten.

**Architecture:** Reshape `TodayFocusHook` into the List insight (Pro-aware, routes to the Patterns focus detail, fixes the broken function-form Pressable style). Add a `FocusPatternsCard` (reusing `FocusCurve` + window range + maturity meter + `FocusWindowEditorSheet`, Pro-gated, NO task-packing) and mount it in `patterns.tsx`. Remove the `'focus'` option from `PlanSegment` + the `tab === 'focus'` branch in the Plan route; keep `FocusMode`/`FocusWindowCard` files (now unused by the tab) or delete if fully orphaned.

**Tech Stack:** TS strict, Reanimated, Jest. Spec §9.1 (List insight), §9.3 (Patterns focus detail), D9. Reuses `src/features/planner/useLearnedFocusWindow.ts`, `FocusCurve.tsx`, `FocusWindowEditorSheet.tsx`, `FocusMode.tsx`.

## Global Constraints
- No-guilt; focus is a suggestion, never a demand. Tokens only (new group → useTheme line). **reactCompiler Pressable gotcha:** function-form `style={({pressed})=>…}` on Pressable SILENTLY renders nothing — put visual style on an inner View, keep Pressable a bare wrapper. (TodayFocusHook currently violates this — FIX it.) Animation entering-only, reduced-motion → final. Layer rule. Pro gating via useEntitlement/ProGate (the curve/detail + the Pro insight are Pro; free sees a teaser). TS strict + noUncheckedIndexedAccess. Conventional Commits; NO AI/co-author attribution. Pre-commit: eslint 0 warnings, typecheck, jest; full suite deterministically green (run twice).

---

### Task A1: Reshape `TodayFocusHook` → List focus insight

**Files:** Modify `src/features/today/TodayFocusHook.tsx` (+ its test).
**MANDATORY skills:** `react-native-expert`, `ui-design:react-native-design`, `conversion-psychology`, `humanizer`, `clean-code`.
- Reshape the row into the design's one-line insight:
  - **Pro:** `◑ Sharpest {start}–{end} · your window for hard tasks` (humanized; the times from the learned window).
  - **Free:** a teaser `Your focus window is ready` + a small Pro pill → paywall (trigger `focus_window`). NEVER the times for free.
  - Route (Pro tap): to the **Patterns** focus detail — `router.push('/(tabs)/patterns')` (Phase 8 will deep-link to the focus section; for now the Patterns tab + a scroll-to is fine, or just the tab). NOT the Plan tab.
- **FIX the Pressable gotcha:** replace `style={({pressed}) => …}` with a bare `<Pressable>` wrapping an inner `<View>` that carries the visual style + a pressed state via `onPressIn/Out` shared value (mirror `RetroLogChip`/`AppButton`). 
- Keep render gates (personal window; before window end; ≥1 queued task) OR relax gate 3 if the insight should show without tasks — keep gates sensible + documented; default: show when a personal window exists and it's before the window end (tasks optional — an insight is useful even with an empty list; decide + note).
- [ ] TDD: Pro shows the times + "hard tasks" copy + routes to Patterns; free shows teaser + no times + routes to paywall; the row actually renders (regression for the function-style bug — assert the visible text is present). Commit `feat(today): focus insight one-liner on the List (routes to Patterns)`.

### Task A2: `FocusPatternsCard` + mount in Patterns

**Files:** Create `src/features/patterns/FocusPatternsCard.tsx` (+ test); Modify `src/app/(tabs)/patterns.tsx` (mount it).
**MANDATORY skills:** `react-native-expert`, `ui-design:react-native-design`, `ui-design:visual-design-foundations`, `svg-animations` (the curve), `clean-code`.
- READ `src/features/planner/FocusMode.tsx`, `FocusCurve.tsx`, `FocusWindowEditorSheet.tsx`, `useLearnedFocusWindow.ts` first. Build `FocusPatternsCard` reusing `FocusCurve` + the learned window range + the maturity meter (forming "X / 15 sessions" vs personal) + an "edit window" action (`FocusWindowEditorSheet`). **No task-packing** (that's the Timeline now).
  - **Pro:** full curve + window range + maturity + edit.
  - **Free:** the curve under a frosted/locked teaser + "Unlock my focus window" → paywall (trigger `focus_window`). (Reuse the existing locked treatment from `FocusMode`/`FocusWindowLocked` if present.)
- Mount in `patterns.tsx` as a section (it's a long scroll today; Phase 8 will slot it into a "Numbers" segment — for now a clearly-labeled "Your focus" section is fine). Read `patterns.tsx` to match its section pattern.
- [ ] TDD: Pro renders the curve + window range + maturity; free renders the locked teaser (no window times) → paywall. Commit `feat(patterns): focus curve + window detail (migrated from Plan tab)`.

### Task A3: Remove the Focus segment from the Plan tab

**Files:** Modify `src/features/routines/PlanSegment.tsx` (drop `'focus'`); Modify the Plan route `src/app/(tabs)/plan.tsx` (remove the `tab === 'focus'` branch + the FocusMode import). Optionally delete `FocusMode.tsx`/`FocusWindowCard.tsx`/`FocusWindowList.tsx`/`FocusWindowLocked.tsx` if now fully orphaned (grep first — `FocusCurve`/`FocusWindowEditorSheet` stay, reused by Patterns).
- `PlanTab` type → `'today' | 'routines'`; OPTIONS → Plan · Routines. The pill physics + tests adjust to 2 segments.
- [ ] TDD: PlanSegment renders 2 segments; the Plan route no longer renders FocusMode; grep confirms no dangling `'focus'`/FocusMode references. (If deleting files, ensure no import breaks + their tests are removed/updated.) Commit `refactor(plan): remove Focus segment (curve now in Patterns, packing in Timeline)`.

### Task B1: Copy + a11y + Pro-gate + review polish
- [ ] Run the new focus strings through conversion-psychology + humanizer (no guilt; "hard tasks" not "you must"). a11y labels on the insight row + the Patterns focus card + edit action. Confirm free never sees the window times (insight or card). Pro-gate leak regression test. Note sim verification pending. Commit `style(focus): insight + patterns copy/a11y/gate`.

## Self-Review
**Coverage:** §9.1 List insight → A1; §9.3 curve/detail to Patterns → A2; D9 (band + plan-pref already in Phase 4); Plan-tab Focus removal (D8 prep) → A3; §10 gating → A1/A2/B1. Out of scope: Patterns segmentation (Phase 8 — A2 mounts as a plain section), Plan→Routines tab rename (Phase 6).
**Decisions:** insight routes to the Patterns tab (Phase 8 adds the deep-link); FocusPatternsCard omits task-packing; keep FocusCurve/editor, remove only the tab's Focus segment + FocusMode if orphaned.

## Execution
Subagent-driven off `feat/planning-timeline`, PR at the end (never merge). Gate: on-device visual of the curve + insight.
