# Data Reset — "Danger Zone" in Settings

**Date:** 2026-06-17
**Status:** Design approved (pending spec review)

## Goal

Give the user two on-device reset actions in Settings, each a distinct, clearly
labelled state inside a **Danger Zone** section, each guarded by a styled in-app
confirm sheet:

1. **Reset progress** (caution / amber) — forget what Whenbee learned, keep the
   setup. Stay in the app.
2. **Erase everything** (danger / red) — wipe the device clean and start the
   welcome onboarding as if freshly installed.

Both ship to real users *and* serve as the dev reset (they replace the existing
`__DEV__`-only "Replay onboarding" row, which becomes redundant).

## Product invariants honoured

- **No guilt language.** Copy frames a reset as a fresh start, never a failure.
- **Core loop stays on-device.** No network. Pro entitlement lives on RevenueCat,
  so it is untouched by either reset — the erase sheet says so and points at
  "Restore purchases".
- **Monotonic honey** is irrelevant to a *deliberate, user-initiated* reset; the
  invariant forbids the model regressing on its own, not the user wiping data.

## Two scopes, precisely

| | **Reset progress** | **Erase everything** |
|---|---|---|
| SQLite (all tables) | **wiped** | **wiped** |
| Companion name + appearance seed | **kept** (restored after wipe) | wiped (re-seeds fresh) |
| Categories (tracked list) | **kept** | wiped |
| Appearance / reminders / daily check-in | **kept** | wiped |
| Learned vocab (guesser) | **kept** | wiped |
| Onboarding-complete flag | **kept** (stay in app) | wiped (back to welcome) |
| Founder-reserve / install stamps | **kept** | wiped (fresh install) |
| Today list, active plan, active timer, graduation/aha/drift flags | wiped | wiped |
| After | Today is empty, calibration restarts from priors, user stays in app | App reboots to `/(onboarding)/welcome` |

## Architecture

One-directional, respects the layer boundaries (`src/app`/`src/components` never
import `src/db`/`src/services` directly — the screen calls a feature hook).

```
settings.tsx (DangerZone rows)
  → ConfirmSheet (styled, two configs)
    → useAccountReset() hook  (src/features/settings)
        → services/dataReset.ts  → db.wipeAll() (port) + kv helpers
        → resets in-memory Zustand stores
        → router.replace('/') on erase
```

### 1. Database port — `wipeAll()`

Add to the `Database` interface + both adapters:

```ts
/** Factory reset: clears every table and returns the companion singleton to its
 *  default row (seed 0 so the next hydrate re-seeds a fresh appearance). */
wipeAll(): Promise<void>;
```

- **sqlite:** `DELETE FROM` task_events, category_stats, recurring_stats,
  log_tags, discoveries; then `UPDATE companion SET … defaults …, seed = 0,
  name = NULL WHERE id = 1`, all in one `withTransactionAsync`.
- **memory:** clear every Map; reset the `companion` object to defaults with
  `seed = 0`.
- TDD: unit-test against `createMemoryDatabase()` — seed rows, `wipeAll()`,
  assert every read returns empty / default.

### 2. `lib/kv.ts` helpers

Add thin wrappers over `expo-sqlite/kv-store` Storage sync API:

```ts
clearAll(): void           // Storage.clearSync()  — nuclear path
getAllKeys(): string[]     // Storage.getAllKeysSync() — selective path
```

(Confirm the exact sync method names against the installed `expo-sqlite`
kv-store types during implementation; fall back to iterating `getAllKeys` +
`removeItemSync` if `clearSync` is absent.)

### 3. `services/dataReset.ts` (logic layer — TDD)

```ts
// Keys/store-names that survive a progress reset (everything else is learning).
const KEEP_ON_PROGRESS = new Set(['settings','categories','vocab','onboarding',
  'whenbee.founderReserved','whenbee.founderReservedAt',
  'whenbee.installAt','whenbee.installFired']);

export async function wipeLearning(db: Database): Promise<void> {
  const { name, seed } = await db.getCompanion();   // capture identity BEFORE wipe
  await db.wipeAll();
  await db.setCompanionName(name);                  // restore name
  await db.setSeed(seed);                            // restore look (wipe set seed=0)
  for (const k of kv.getAllKeys()) if (!KEEP_ON_PROGRESS.has(k)) kv.delete(k);
}

export async function wipeEverything(db: Database): Promise<void> {
  await db.wipeAll();
  kv.clearAll();
}
```

**Companion identity on progress reset:** capture `name` + `seed` from
`companionRepo.get()` *before* `wipeAll()`, then after the wipe call
`setCompanionName(name)` and `setSeed(seed)` (the latter works because wipe set
seed back to 0, and `setSeed` only writes when seed is 0). This keeps the named,
same-looking companion while resetting its growth. Done in the service so it is
unit-tested with the rest of the wipe.

Tests assert: after `wipeLearning`, kept keys remain and learning keys/tables are
gone and companion name/seed survive; after `wipeEverything`, the db is default
and `kv.getAllKeys()` is empty.

### 4. `features/settings/useAccountReset.ts`

Returns `{ resetting, resetProgress, eraseEverything }`. Each handler:

1. resolves the db (`getDatabase()`),
2. calls the matching service function,
3. resets the in-memory Zustand stores so live UI matches storage:
   - **both:** `tasksStore.clear()`, `planStore.reset()`, `timerStore.cancel()`,
     `calibrationStore.reset()` (new: `logs=0, statsByCategory={},
     graduatedCategories=new Set()`), then `calibrationStore.hydrate()` to
     repopulate caches from the now-clean db.
   - **erase only, additionally:** `categoriesStore.reset()`,
     `settingsStore.reset()`, `vocabStore.reset()`, `onboardingStore.reset()`,
     then `router.replace('/')` → `Index` redirects to welcome.

New store reset actions to add (each sets in-memory back to its initial literal;
persist middleware writes the cleared state through to KV):
`calibrationStore.reset`, `categoriesStore.reset`, `settingsStore.reset`,
`vocabStore.reset`, `planStore.reset`. (`tasksStore.clear`,
`timerStore.cancel`, `onboardingStore.reset` already exist.)

### 5. `components/ConfirmSheet.tsx`

A reusable, styled bottom-sheet confirm (NOT a native alert). Props:
`{ visible, tone: 'caution'|'danger', glyphKind, title, bullets: string[],
confirmLabel, onConfirm, onCancel }`.

- Surface + `hairline` border + `radii.card`, slides up over a scrim.
- Leading `DataResetGlyph` tinted by tone (amber `accent` / red `danger`).
- Title, a short consequence list (plain bullets), then a danger-tinted confirm
  `AppButton` + a quiet Cancel.
- Motion via `motion-design` + `creating-reanimated-animations`: scrim fade +
  sheet translateY spring in, reverse out; reduced-motion → instant. All tokens
  from `tokens.ts`; respects `useSafeAreaInsets().bottom`.

### 6. `components/DataResetGlyph.tsx`

New member of the 24-box / 1.6-stroke / indigo+amber glyph family
(`kind: 'progress' | 'erase'`):

- **progress** — an amber counter-clockwise refresh arc curving around an indigo
  seed/dot ("start the growing over"). One-shot 360° ease on confirm.
- **erase** — a danger-tinted sweep/broom over a small dust scatter (or a tidy
  trash silhouette) ("clear it all out"). One-shot sweep on confirm.
- Internal, calm idle is optional; reduced-motion guarded; danger uses the
  `danger` token rather than amber for the erase kind.

### 7. `settings.tsx` — Danger Zone section

Replace the `__DEV__` Developer block with an always-visible section:

```
AppText variant="label" (danger-tinted) — "Danger zone"
  SettingRow  icon=DataResetGlyph(progress)  tint=accent
    title "Reset progress"   note "Forget what Whenbee learned — keep your setup."
  SettingRow  icon=DataResetGlyph(erase)     tint=danger
    title "Erase everything" note "Wipe the app and start the welcome over."
```

Tapping a row opens `ConfirmSheet` with that scope's config. On confirm: call the
hook, show a `Toast` on the progress path ("Progress reset — fresh slate."); the
erase path navigates away so no toast is needed.

`SettingRow` currently takes an Ionicons `icon` name. Extend it to also accept a
`leading?: ReactNode` (render that instead of the Ionicon when present) so the
custom glyph slots into the existing row shape without duplicating layout.

## Copy (draft — finalised via conversion-psychology + humanizer)

- Section: **Danger zone**
- Row 1: **Reset progress** · "Forget what Whenbee learned — keep your setup."
- Row 2: **Erase everything** · "Wipe the app and start the welcome over."
- Progress sheet: title **"Reset your progress?"**, bullets: "Clears every logged
  time and what Whenbee learned.", "Keeps your categories, look, and reminders.",
  "Your Whenbee keeps its name — just starts growing again." Confirm: **"Reset
  progress"**.
- Erase sheet: title **"Erase everything?"**, bullets: "Deletes all of it — tasks,
  learning, categories, settings.", "You'll start from the welcome screen, like a
  fresh install.", "Pro isn't stored here — 'Restore purchases' brings it back."
  Confirm: **"Erase everything"**.
- Progress toast: **"Reset done — fresh slate."**

No guilt, no shame, no streak language anywhere.

## Testing

- **TDD (logic):** `db.wipeAll()` (memory adapter), `services/dataReset` (both
  scopes incl. companion-identity preservation and the keep-list), the new store
  `reset` actions (in-memory → initial).
- **Component:** ConfirmSheet renders both tones, fires `onConfirm`/`onCancel`;
  optional snapshot of the Danger Zone rows.
- Manual sim pass per the CLAUDE.md reset/screenshot recipe.

## Out of scope / YAGNI

- No "export my data first" step (nothing is uploaded; user owns the device).
- No undo (the confirm sheet is the guard).
- No per-category picker here (that already exists in category detail's reset).
- No `expo-updates` JS reload — explicit store resets cover prod correctly.
