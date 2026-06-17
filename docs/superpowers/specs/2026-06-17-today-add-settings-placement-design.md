# Today: move `+` to the header, settings to the tab bar

**Date:** 2026-06-17
**Status:** Approved (design) — ready for implementation plan
**Topic:** Relocate the Today `+` action and the settings entry.

## Decision summary (Option 1)

- The Today header's **right slot becomes the `+` (add a task)** button, styled **quiet/neutral** (`inkSoft`) — not indigo. Start now keeps the screen's only solid indigo fill (hero).
- The **floating FAB is deleted** from the Today screen — no more hovering coin.
- **Settings becomes a 5th bottom tab** (`Today · Plan · Whenbee · Patterns · Settings`), replacing the pushed `/settings` Stack route.
- `+` appears on **Today only** (Plan/Whenbee/Patterns headers are unchanged).

## Goal / non-goals

**Goal:** kill the unanchored floating `+`, give the add action an intentional iOS-native home (the compose corner), and surface settings where the user expects a persistent destination.

**Non-goals:** redesigning the add-task modal, the Start/timer flow, the honey HUD, or any other tab. No change to what `+` does (still opens `/(modals)/add-task`). No new add path on Plan (deferred — see Open trade-offs).

## Current state (grounding)

- `src/app/(tabs)/index.tsx`
  - Header right slot = `settings-outline` gear → `router.push('/settings')` (line ~152).
  - Floating FAB (lines ~92–135, ~250–265): a neutral raised "coin" with an indigo `+`, 3D press animation, opens `/(modals)/add-task`. ScrollView reserves `FAB_SIZE + space[8]` bottom padding for it.
- `src/app/settings.tsx` — a **Stack** route (`src/app/_layout.tsx` lines ~49–60) with a native header + back button + swipe-back. Pushes child screens (`categories`, `privacy`, paywall).
- `src/components/WhenbeeTabBar.tsx` — custom bar, 4 routes, a sliding indicator whose math already generalizes over `count` (`barW / count`). No hardcoded 4.
- `src/components/TabIcon.tsx` — each tab glyph is **hand-tuned SVG stroke subpaths** that "draw themselves on" when focused. `TabIconName = 'home' | 'calendar' | 'bee' | 'pulse'`. A new glyph must be added here as stroke subpaths with a tuned `len`.
- Only **one** navigation site points at `/settings` — the Today gear (being replaced). The only other reference is a hardcoded path string in `src/lib/__tests__/copyAudit.test.ts:157`.

## Design

### 1. Today header → `+`
- Replace the gear `Pressable` in `(tabs)/index.tsx`'s `ScreenHeader right` with a `+` button:
  - `Ionicons name="add"`, `size 22`, color **`t.colors.inkSoft`** (neutral — matches the old gear's weight; Start stays the only loud element).
  - `onPress` → `haptics.light()` + `router.push('/(modals)/add-task')`.
  - `accessibilityRole="button"`, `accessibilityLabel="Add a task"`, `hitSlop={8}`.
  - Press feedback: simple opacity dim (same archetype as the old gear), **not** the coin 3D drop. No new tokens needed.

### 2. Delete the floating FAB
- Remove from `(tabs)/index.tsx`: `FAB_SIZE`/`FAB_EDGE`, `fabPosition`/`fabEdge`/`fabCircle`, the reanimated `fabY`/`fabAnim`/`fabPressIn`/`fabPressOut`, and the FAB `Pressable` block.
- Recompute the ScrollView `contentContainerStyle.paddingBottom` — drop the FAB reservation; keep enough bottom space for the RetroLogChip to clear the tab bar (use a spacing token, e.g. `t.space[8]`, not the removed `FAB_SIZE`).

### 3. Settings → 5th tab
- Create `src/app/(tabs)/settings.tsx`. Move the screen body from `src/app/settings.tsx` into it, with one change: it no longer relies on the native back header — it renders the shared `ScreenHeader title="Settings"` (no right slot, no back), consistent with every other tab screen (`headerShown:false` is already set tab-wide).
- Child navigations (`categories`, `privacy`, paywall) stay as Stack pushes from within the tab — unchanged and still dismissible by the stack's swipe-back.
- `(tabs)/_layout.tsx`: add `<Tabs.Screen name="settings" options={{ title: 'Settings' }} />` after `patterns`.
- `src/app/_layout.tsx`: remove the `<Stack.Screen name="settings" …>` block (the route moves under `(tabs)`).
- Delete the old `src/app/settings.tsx`.
- Update the path string in `src/lib/__tests__/copyAudit.test.ts` to the new location.

### 4. Tab bar + glyph
- `WhenbeeTabBar` needs no structural change (indicator math is `count`-based). Verify the 5-up labels (`Whenbee`, `Patterns`, `Settings`) don't truncate at `1/5` width and `fontSize.xs`; if tight, allow a single line with no wrap rather than shrinking type.
- `TabIcon`: add a `'settings'` glyph to `TabIconName` + `ICON_PATHS`, and map `settings: 'settings'` in `WhenbeeTabBar.ICONS`.
  - **Glyph sub-decision:** a literal multi-tooth gear is expensive/fragile in the stroke-dash draw-on system. Recommended: a **simplified gear** — an outer cog approximated by a rounded ring with ~6 short radial tick strokes + a center dot — OR a **sliders/adjustments** glyph (two horizontal tracks with knobs), which draws cleanly and still reads "settings." Pick during implementation with `creating-reanimated-animations` + the draw-on archetype (calm sine ease, monotonic, reduced-motion snaps). The header `+` and any other gear iconography stay Ionicons; only the tab glyph is custom.

## Edge cases
- Empty-state `onPrimary` and the `RetroLogChip` still open `add-task`/`retro` — unchanged.
- Reduced motion: header `+` press and the new tab glyph honor `useReducedMotion()` (snap, no draw).
- Deep links / existing pushes to `/settings`: none remain except the replaced gear; no redirect needed. (If any external/onboarding link is found during impl, repoint to `/(tabs)/settings`.)

## Testing
- Tab bar renders **5** tabs; indicator lands centered under each (incl. the new last tab).
- Today header `+` opens `add-task`; carries no settings entry.
- Settings tab renders with the in-app `ScreenHeader` (no native back); its child routes (`categories`, `privacy`, paywall) still push and dismiss.
- `copyAudit` test passes against the new settings path.
- Snapshot/interaction test for the 5-tab bar + reduced-motion.
- Lint + typecheck + jest green before PR.

## Open trade-offs (accepted)
- **Settings as a peer tab** to core destinations is heavy for rarely-used config (the WhatsApp-style "tuck it away" pattern argues against it) — accepted by the founder; it matches "settings in the actual nav bar."
- **Top-right `+`** is a one-handed stretch vs the old thumb-zone FAB — accepted as the cost of de-cluttering and the iOS compose convention.
- Add-on-Plan is **out of scope** for now (could revisit if `+` proves under-reached on Today).

## Files touched
- `src/app/(tabs)/index.tsx` — `+` in header, delete FAB, fix scroll padding.
- `src/app/(tabs)/settings.tsx` — **new** (moved from `src/app/settings.tsx`, ScreenHeader instead of native back).
- `src/app/settings.tsx` — **deleted**.
- `src/app/(tabs)/_layout.tsx` — add Settings `Tabs.Screen`.
- `src/app/_layout.tsx` — remove Settings `Stack.Screen`.
- `src/components/WhenbeeTabBar.tsx` — add `settings` to `ICONS`; verify 5-up labels.
- `src/components/TabIcon.tsx` — add the `settings` glyph.
- `src/lib/__tests__/copyAudit.test.ts` — update settings path string.

## Delivery
Implement in a **git worktree**; open a **PR without merging** (founder reviews + merges). Conventional Commits, **no AI/co-author attribution**.
