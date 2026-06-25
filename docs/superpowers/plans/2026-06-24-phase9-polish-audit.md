# Planning Expansion — Phase 9: Cross-Cutting Polish + Audit

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps.
> **Branch off Phase 8** (`feat/planning-patterns`, PR #55). The final phase — a HOLISTIC pass over the whole planning feature (Phases 1–8), which the per-phase reviews never saw together.
> NOTE: pin Date.now in any date-dependent test.

**Goal:** Ship-readiness for the planning expansion. A cross-phase **Pro-gate leak audit**, a **no-guilt copy** sweep, a **motion/a11y/token** consistency pass, and a consolidated **device-verification checklist** (the founder's manual gate) — closing the gaps that only show when the 8 phases are viewed as one product.

**Architecture:** Mostly audit + small fixes (no new features). Each task is an audit that may produce targeted fixes + regression tests, ending green.

## Global Constraints
- No new features (this is polish). No-guilt invariant absolute. Tokens only. Pro-gate: free never sees a gated value OR its position. TS strict. Conventional Commits; NO AI/co-author attribution. Pre-commit: eslint 0, typecheck, jest green ×2.

---

### Task A1: Holistic Pro-gate leak audit (cross-phase)
**Files:** audit across all new Pro surfaces; add regression tests where coverage is thin.
- Enumerate EVERY Pro-gated planning surface and confirm a FREE user sees neither the value nor its position (no number, no bar/segment, no row rendered — container absent, not merely hidden):
  - Capacity chip (Phase 3), read-only calendar overlay (Phase 3), Plan-my-day + Timeline (Phase 4), focus insight + Patterns focus card (Phase 5), Routines (incl. scheduled-routine day blocks + their capacity contribution) (Phase 6), calendar export toggle (Phase 7), Patterns Correlations (Phase 8).
- For each, verify the gate is at the RENDER level (free path returns the teaser/null) AND the underlying hook doesn't leak a value into a free-visible number. Add a regression test for any surface lacking one.
- [ ] Produce a short audit note in the report + any fix commits. Commit (if fixes) `test(planning): cross-phase Pro-gate leak regression coverage`.

### Task A2: No-guilt copy + humanizer sweep
**MANDATORY skills:** `conversion-psychology`, `humanizer`.
- Grep every new planning string for guilt/shame/streak words: `overdue|behind|failed|missed|late|you should|you must|don't forget|streak|don't break`. Confirm ZERO in user-facing copy (carryover tag, capacity "move one?", move labels, recap, empties, focus insight, routine alerts/recap, export contract, Patterns empties, paywall triggers' framing). Fix any. Run remaining new strings through humanizer for AI-slop tells.
- [ ] Commit (if changes) `style(planning): final no-guilt copy + humanizer sweep`.

### Task A3: Motion + a11y + token consistency sweep
- Motion: grep new components for `withSpring`/bounce/overshoot on content + `exiting` layout anims on conditionally-unmounted views (Fabric SIGABRT) + function-form `style={({pressed})=>…}` on Pressable (silent-render gotcha). Confirm entering-only + reduced-motion → final everywhere. Fix any.
- a11y: spot-check the new interactive elements (strip cells, capacity chip, move/delete actions, timeline, routine run controls, segment controls, export toggle) have roles + labels + selected/expanded state. Fix gaps.
- Tokens: grep new files for raw hex (`#[0-9a-fA-F]{3,8}`) and suspicious raw numeric font sizes/spacing not from tokens. Fix any stragglers (add a token if needed + the useTheme line).
- [ ] Commit (if changes) `style(planning): motion/a11y/token consistency sweep`.

### Task B1: Device-verification checklist + final green
**Files:** Create `docs/product/planning-device-verification.md`.
- Consolidate every "sim verify pending" item across Phases 2–8 into one founder checklist, grouped by surface, with the exact thing to look at and (where relevant) the deep-link to reach it (`xcrun simctl openurl booted "whenbee:///..."`). Cover the on-device-only gates: **calendar permission + real events overlay (P3), calendar export writes to the Whenbee calendar + disable removes them (P7), routine notifications + Live Activity + chime (P6), the strip/timeline/recap/chip visuals, the focus curve, the segmented Patterns**. Mark the calendar-export + notification items as **must-verify-before-store-submission**.
- Final: full `npm run lint` (0) + `npm run typecheck` + `npm test` green ×2.
- [ ] Commit `docs(planning): device-verification checklist (founder gate)`.

## Self-Review
**Coverage:** §19 Phase 9 (copy/motion/a11y + Pro-gate audit + device) → A1/A2/A3/B1. Closes the cross-phase gaps the per-phase reviews couldn't see.

## Execution
Subagent-driven off `feat/planning-patterns`, PR at the end (never merge). The device checklist is the founder's manual gate before App Store submission (see docs/product/11-APP-STORE-LAUNCH-BLOCKERS.md).
