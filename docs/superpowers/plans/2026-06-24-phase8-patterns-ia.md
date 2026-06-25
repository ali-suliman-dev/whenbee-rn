# Planning Expansion — Phase 8: Patterns IA

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 7** (`feat/planning-export`, PR #54). Restructures `src/app/(tabs)/patterns.tsx` + the PatternCard dismissal. Reuses the existing pattern blocks (ArchetypeHero, ProgressChart, PlanExperiment, DriftNote, BiggestSurprise, HonestMap, FocusPatternsCard, the Pro correlations, ReviewRitual).
> NOTE: pin Date.now in any date-dependent test.

**Goal:** Tame the Patterns junk-drawer. Keep the **archetype hero pinned** (the identity), pin the **Review ritual** under it (the one amber moment), and organize everything else under a **3-segment control [Numbers · Insights · Correlations]**. The dismissable insights get their own segment and their **dismissals become durable** (delete = gone for good, not session-only).

**Architecture:** A `PatternsSegment` control (mirror the existing pill segment) drives which group renders. `patterns.tsx` becomes: hero + review (pinned) + segment control + the selected segment's blocks. Numbers = progress + numbers + focus; Insights = the dismissable feed; Correlations = the Pro correlations. `PatternCard`'s session `useState` dismissal is replaced by a kv-backed durable dismissal keyed by a stable card id.

**Tech Stack:** TS strict, Reanimated, Zustand/kv, Jest. Spec §9.3, D12. Reuses all existing Patterns components — no engine change.

## Global Constraints
- No-guilt; no streaks; amber stays scarce. The archetype is identity, never a score. Tokens only (new group → useTheme line). Animation entering-only (the existing rise/stagger), reduced-motion → final, no bounce. Pro-gate: Correlations is Pro (the existing ProGate/locked-teaser pairing preserved; free sees the teaser, never the data). reactCompiler Pressable gotcha. TS strict + noUncheckedIndexedAccess. Conventional Commits; NO AI/co-author attribution. Pre-commit: eslint 0, typecheck, jest green ×2.

---

### Task A1: `PatternsSegment` control
**Files:** Create `src/features/patterns/PatternsSegment.tsx` (+ test).
**MANDATORY skills:** `react-native-expert`, `ui-design:react-native-design`, `ui-design:interaction-design`.
- A 3-option segmented control [Numbers · Insights · Correlations] — mirror the gliding-pill physics + token styling of the old `PlanSegment` (deleted in Phase 6 — replicate the pattern from git history or from `AdaptSegment` if it exists; read an existing segmented control). `type PatternsTab = 'numbers' | 'insights' | 'correlations'`. Props `{ value, onChange }`. a11y: role tablist + accessibilityState selected.
- [ ] TDD: renders 3 segments; tapping one calls onChange; selected pill physics derive from option count. Commit `feat(patterns): 3-segment control (Numbers/Insights/Correlations)`.

### Task A2: Durable insight dismissals
**Files:** Find `PatternCard` (the dismissable wrapper used by DriftNote/BiggestSurprise/PlanExperiment — grep `PatternCard`); Modify it; add a tiny kv-backed dismissal helper (+ test).
- Replace the session `useState`-based dismissal with a **durable** one: each dismissable card has a STABLE id (e.g. the card type + a content key — DriftNote/BiggestSurprise/PlanExperiment must pass a stable `dismissId`); dismissing writes the id to kv (a `patterns-dismissed` set); a dismissed id renders `null` on future loads. Provide a small helper `usePatternDismiss(id): { dismissed: boolean; dismiss: () => void }` over kv. (Research from brainstorming: a dismissed insight must NOT regenerate — the #1 "spam" complaint.)
- The dismissId must be stable for the same insight but allow a genuinely-new insight (different content) to appear (e.g. include a content hash/period so a new week's surprise isn't pre-dismissed). Decide + document the id scheme.
- [ ] TDD: dismissing a card persists the id (kv) and the card renders null after; a different id is unaffected; re-mounting keeps it dismissed. Commit `feat(patterns): durable insight dismissals (no regenerate)`.

### Task B1: Restructure `patterns.tsx` into hero + segments
**Files:** Modify `src/app/(tabs)/patterns.tsx` (+ update/relocate its screen test).
**MANDATORY skills:** `react-native-expert`, `ui-design:react-native-design`, `ui-design:visual-design-foundations`, `clean-code`.
- New structure:
  1. **Archetype hero** — pinned, always (ArchetypeHero / ArchetypePlaceholder). The identity headline.
  2. **Review ritual** — pinned under the hero (Pro card / locked teaser) — the one amber moment, kept visible when fresh.
  3. **`<PatternsSegment value=… onChange=… />`** (default 'numbers').
  4. The selected segment's content:
     - **Numbers** (free): "Your progress" (ProgressChart + PlanExperiment) + "Your numbers" (HonestMap) + "Your focus" (FocusPatternsCard). (PlanExperiment is a stat here, NOT a dismissable insight — or keep it dismissable in Insights; DECIDE: per the brainstorm, PlanExperiment is a dismissable insight → put it in Insights. Keep Numbers = progress chart + HonestMap + Focus. Document the choice.)
     - **Insights** (free): the dismissable feed — DriftNote + BiggestSurprise + PlanExperiment (each durable-dismissable via A2). Empty → a calm "No new insights" line.
     - **Correlations** (Pro): StealsYourTime/Weekly + Accuracy + Context (the existing ProGate/locked pairing; free sees the single teaser).
  - Keep the entering-only rise/stagger per segment switch (reduced-motion → instant). Persist the selected tab for the session (local state is fine; a store field optional).
  - Empty state (view.empty) unchanged.
- [ ] TDD: the hero + review render always; switching to Insights shows the dismissable cards (and dismissing one hides it); Correlations shows the Pro content (Pro) / the teaser (free); Numbers shows the chart + map + focus. (Mock usePatterns/useReview/entitlement; match the existing patternsScreen test harness.) Commit `feat(patterns): archetype hero + 3-segment restructure`.

### Task C1: copy + a11y + Pro + review
- [ ] Segment labels + the "No new insights" empty + any new copy through conversion-psychology + humanizer (no guilt/streak). a11y on the segment + the dismiss × (label "Dismiss {insight}"). Confirm Correlations stays Pro (free → teaser only, no data leak) — regression test. Reduced-motion check. Commit `style(patterns): IA copy/a11y/gate polish`.

## Self-Review
**Coverage:** §9.3 (hero + 3 segments; Insights = dismissable feed; Correlations Pro) → A1/B1; durable dismissals (no regenerate) → A2; D12 → all. Out of scope: final cross-cutting polish (Phase 9).
**Decisions:** archetype + review pinned (not a tab); PlanExperiment → Insights (dismissable) — document; dismissId scheme includes a content/period key so new insights aren't pre-dismissed.

## Execution
Subagent-driven off `feat/planning-export`, PR at the end (never merge). Gate: visual of the segmented Patterns + the dismiss interaction.
