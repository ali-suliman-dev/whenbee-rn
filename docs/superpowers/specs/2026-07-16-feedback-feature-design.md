# Feedback feature — design spec

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**Author:** brainstormed with founder
**Visual mock:** `scratchpad/feedback-mock.html` (v2 — reviewed and approved)

---

## 1. What this is

A near-zero-friction way for users to send the founder feedback, and for the
founder to close the loop by posting what shipped. Two thin surfaces:

1. **Send feedback** — a private, one-way intake sheet (tag + free text).
2. **What's new** — a read-only changelog the founder publishes.

This is the pre-TestFlight "feedback board" gap named in `CLAUDE.md`, built as a
**private one-way channel**, not a public Canny-style vote board.

### Why private one-way (not a public board)

Research (Canny best-practices, Evanish's "feature voting" critique, Featurebase
comparisons) is consistent for an app at low-thousands of users:

- Public boards die at the cold-start: 3 stale posts read as "nobody listens."
- Votes are noise — "a 250-vote feature is 250 different interpretations."
- Moderation + duplicate triage lands entirely on a solo founder.
- Account-to-vote friction kills genuine feedback.

The winning shape for this size: **start private, one-way, low-friction,
founder-curated, and close the loop with a changelog.** That is exactly this design.

---

## 2. Decisions (locked)

| Topic | Decision |
| --- | --- |
| Model | Private, one-way. No public list, no votes, no comments. |
| Surfaces | ① Send feedback (private intake) ② What's new (read-only changelog) |
| Intake shape | One tag (**Idea / Problem / Love**) + one optional area chip + free text |
| Founder posting | Broadcast changelog only ("you asked, I built it"). No per-user replies. |
| Placement | Two rows in Settings under a **Feedback** section. "What's new" shows an amber unread dot. |
| Onboarding | One quiet founder-voice line on the existing final screen. No new step. |
| Identity | Anonymous. Random per-install ID (not PII) + app version / OS / locale. No name, email, or login. |
| Hosting | Supabase (existing project `iptnmqcrmxakwqbaqugs`), `public` schema, `feedback_` table prefix. |
| Pause handling | Optimistic client + background retry + local queue (free-tier auto-pause never shows a failure). |

### Non-goals (YAGNI — explicitly out)

Votes · public board · per-user replies · email / any PII · polls · push
notifications · in-app moderation UI (the Supabase dashboard is the admin surface).
All are addable later without reworking this.

---

## 3. Product surfaces

### 3.1 Settings rows

A new **Feedback** section (`<AppText variant="label">Feedback</AppText>`) with two
`SettingRow`s, placed after "Your data" / before "Account" (final copy in §4):

- **Send feedback** — icon `chatbubble-ellipses-outline`, `inkSoft`. Opens the intake sheet.
- **What's new** — icon `sparkles-outline`, `accent`. Opens the changelog. Renders an
  amber unread `dot` (§3.4) when there is an unseen published entry.

Rows follow the existing `SettingRow` shape exactly (flat `surface` panel, no border
since `borderWidth.hairline = 0`, `radii.card`, `type.bodySmBold` title + `type.caption` note).

### 3.2 Send feedback sheet — `src/app/(modals)/feedback.tsx`

A `formSheet` modal. Obeys the modal hard-rules: `headerShown: false` (registered in
`(modals)/_layout.tsx`), `<SheetGrabber />` at top, side gutters from the native
`contentStyle` (screen passes `horizontalPadding={false}`), root column anchored to
`minHeight: winH * 0.95 - insets.bottom` so the Send button pins to the bottom.

Contents, top to bottom:

- Title `type.title` "Tell me what to build" + subtitle `type.body`/`inkSoft`.
- **Kind** — label + a row of three `Chip`s: **Idea** (`bulb-outline`), **Problem**
  (`alert-circle-outline`), **Love** (`heart-outline`). Single-select, one required,
  defaults to none (Send disabled until a kind is chosen).
- **About (optional)** — label + a row of quieter `Chip`s built from the user's own
  category names (fallback set: Timer / Calibration / Planning / Other). Single-select,
  optional, nullable.
- **Text box** — multiline `TextInput` on `surfaceSunken`, `radii.md`, 1–4000 chars.
  Uses the `TaskTitleField` autofocus pattern (re-key on `useIsScreenFocused` +
  `requestAnimationFrame` focus in `onLayout`) so the Android formSheet keyboard rises.
- **Send** — `AppButton` default size (never `lg`), `fullWidth`, filled indigo coin-edge.
  Disabled until a kind is selected and body is non-empty.

On Send: optimistic transition to the **Sent** state (§3.3) immediately; the write
happens in the background (§5.2). The single primary CTA per screen is Send.

### 3.3 Sent state

Replaces the form inside the same sheet: an `accent` `checkmark-circle-outline` glyph
(the real app may use `BeeMascot`; a checkmark is the fallback), "Got it. Thank you."
(`type.title`/`subtitle`), a one-line reassurance, and a ghost **Done** that dismisses.
Auto-dismiss after ~2.2s (`motion` token) if untouched. Entrance = opacity fade only
(animation hard-rule: no slide-up, no bounce).

### 3.4 What's new — `src/app/(modals)/whats-new.tsx`

A read-only list (fetched on open, cached in kv). Each published entry is a flat
`surface` card: a status pill (**Shipped** = amber `accentChip`, **Planned** = indigo
`primaryChip`), the entry title (`type.bodySmBold`), one-line body (`type.caption`),
and a date (`Inter` mono, `inkFaint`). Unseen entries carry a small amber `newmark`.

**Unread logic:** kv stores `feedback.changelog.lastSeenAt` (ISO). The Settings row dot
and per-entry `newmark` show when `entry.published_at > lastSeenAt`. Opening the screen
sets `lastSeenAt = max(published_at)` on unmount.

Empty / fetch-failure → show cached entries, else a muted empty state ("Nothing new yet.").

### 3.5 Onboarding line

One line on the existing final screen (the "you're all set / Open my day" step — locate
in `src/app/(onboarding)/`). No new step, no layout change, no animation change:

> **Made by one person.** Tell me what to add anytime, it's in Settings.

`type.caption`/`inkSoft`, centered, above the CTA. "Made by one person." bolded to `ink`.

---

## 4. Copy (final — conversion-psychology + humanizer applied)

| Slot | String |
| --- | --- |
| Settings row 1 title | Send feedback |
| Settings row 1 note | An idea, a snag, or what's working. Comes straight to me. |
| Settings row 2 title | What's new |
| Settings row 2 note | What you asked for, and what I shipped. |
| Sheet title | Tell me what to build |
| Sheet subtitle | It's just me building Whenbee. Your note comes straight to me. |
| Kind label | What kind? |
| Kind chips | Idea · Problem · Love |
| Area label | About (optional) |
| Text placeholder | A rough idea, something that bugged you, or what's working… |
| Send button | Send |
| Sent title | Got it. Thank you. |
| Sent body | That came straight to me. When it turns into something, you'll see it under What's new. |
| Sent dismiss | Done |
| Changelog title | What's new |
| Changelog empty | Nothing new yet. |
| Onboarding line | **Made by one person.** Tell me what to add anytime, it's in Settings. |

Voice notes: honest ("it's just me"), specific, no hype, no em-dashes, no guilt language
(product invariant). "Love" replaces "Praise" — it is the user's own word for the feeling,
not a request to be praised.

---

## 5. Architecture

Layered per the repo rules: `src/app` / `src/components` must not import
`src/services/*` or `src/db/*` — everything routes through a store/hook.

```
(modals)/feedback.tsx, (modals)/whats-new.tsx, settings.tsx, onboarding final
   → useFeedback (hook/store)              ← the ONLY thing the UI imports
      → services/feedback.ts               ← owns the supabase-js client
         → Supabase (public schema, feedback_* tables, RLS)
   → lib/kv.ts                             ← install_id + changelog lastSeenAt + offline queue
```

### 5.1 `src/services/feedback.ts` (guarded)

- Lazily constructs one `supabase-js` client from `EXPO_PUBLIC_SUPABASE_URL` +
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon/publishable key — safe in-client; RLS is the guard).
  **Never** the service_role key.
- Checks `isExpoGo` and missing-env: in Expo Go or without keys, `submitFeedback` queues
  locally and `fetchChangelog` returns `[]` — no crash.
- API:
  - `submitFeedback(input: { kind; category?; body }): Promise<void>` — attaches
    `install_id`, `app_version`, `os`, `locale`; inserts into `feedback_submissions`.
  - `fetchChangelog(): Promise<ChangelogEntry[]>` — selects published rows,
    `order by published_at desc`.
- No React, no direct UI concerns. Pure-ish service; unit-testable with a mocked client.

### 5.2 Optimistic submit + retry + offline queue

- UI flips to Sent immediately (never blocks on the network — this also hides the
  Supabase free-tier cold-start wake).
- `submitFeedback` retries the insert ~3× with backoff. On final failure it appends the
  payload to a kv queue (`feedback.queue`).
- On next app foreground / next successful submit, the queue is drained (fire-and-forget).
- The user never sees a submit failure for a one-way note. (No toast on failure.)

### 5.3 `install_id`

A random UUID minted once and stored in kv (`feedback.installId`). Not PII, not tied to
any account. Lets the founder group one person's notes and lets a DB-side rate limit work.

### 5.4 `useFeedback` hook/store

Thin: exposes `submit(input)`, `changelog` (with load state), `hasUnread`, and
`markChangelogSeen()`. Backed by the service + kv. Components import only this.

---

## 6. Data model (Supabase — `public` schema)

```sql
-- Raw inbound feedback. Anon can INSERT only; never SELECT/UPDATE/DELETE.
create table public.feedback_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('idea','problem','love')),
  category     text,
  body         text not null check (char_length(body) between 1 and 4000),
  install_id   uuid not null,
  app_version  text,
  os           text,
  locale       text,
  handled      boolean not null default false   -- founder triage flag (dashboard only)
);

-- Founder-published changelog. Anon can SELECT published rows only.
create table public.feedback_changelog (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  status        text not null check (status in ('shipped','planned')),
  title         text not null,
  body          text not null,
  is_published  boolean not null default false
);

create index on public.feedback_changelog (is_published, published_at desc);
```

### RLS (the entire safety story)

```sql
alter table public.feedback_submissions enable row level security;
alter table public.feedback_changelog   enable row level security;

-- Submissions: anon may INSERT, nothing else. No SELECT policy => no reads.
create policy feedback_insert on public.feedback_submissions
  for insert to anon with check (
    char_length(body) between 1 and 4000
    and kind in ('idea','problem','love')
  );

-- Changelog: anon may SELECT only published rows.
create policy changelog_read on public.feedback_changelog
  for select to anon using (is_published = true);
```

- No `authenticated` role is used (app has no login).
- **Rate limiting:** basic abuse guard on `install_id`. Start with the client-side queue
  + a reasonable server ceiling; if abuse appears, add a Postgres trigger or a lightweight
  Edge Function counting recent inserts per `install_id`. Not required for v1 launch —
  flagged as a follow-up, not silently dropped.
- Founder writes/publishes changelog and reads submissions via the Supabase dashboard
  (service role), never from the app.

### 6.1 Free-tier auto-pause

The project pauses after ~1 week idle; the first request wakes it (a few-second cold
start). §5.2's optimistic-client + retry makes this invisible on submit. Changelog reads
fall back to cache during a wake. No keep-warm cron for v1 (can add later if needed).

---

## 7. Config & dependencies

- New dep: `@supabase/supabase-js` (install with `npx expo install`).
- Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public anon key).
  Documented in `docs/DEVELOPMENT.md`; real values in EAS secrets / `.env` (never committed).
- `(modals)/_layout.tsx`: register `feedback` and `whats-new` with `headerShown: false`.
- Modal anchor: both routes need `unstable_settings` anchor `(tabs)` (or a deep-link
  guard) so a cold deep-link doesn't trap the user in the drawer.

---

## 8. Testing (TDD — logic layer required)

Write tests first for:

- `services/feedback.ts`: `submitFeedback` builds the correct payload (kind/category/body
  + install_id/version/os/locale); retries then queues on failure; `fetchChangelog` maps
  rows and orders correctly; Expo-Go / missing-env path no-ops safely.
- `install_id`: minted once, persisted, stable across calls.
- Offline queue: enqueue on failure, drain on next success, no duplicate sends.
- Changelog unread logic: `hasUnread` true iff a published entry is newer than
  `lastSeenAt`; `markChangelogSeen` advances it.
- RLS: a direct anon-key probe test — INSERT into submissions succeeds, SELECT is denied;
  changelog SELECT returns only published rows. (Integration-style; can run against the
  live project or be documented as a manual verification step if CI can't reach Supabase.)

UI (sheet, changelog list, settings rows) — interaction/snapshot tests welcome, not required.

---

## 9. File list (new / touched)

New:

- `src/app/(modals)/feedback.tsx` — send sheet
- `src/app/(modals)/whats-new.tsx` — changelog list
- `src/services/feedback.ts` — guarded service + supabase client
- `src/features/feedback/useFeedback.ts` — hook/store the UI imports
- `src/features/feedback/types.ts` — `FeedbackInput`, `ChangelogEntry`, `FeedbackKind`
- `src/features/feedback/__tests__/*` — TDD suites
- `supabase/migrations/xxxx_feedback.sql` — tables + RLS (or applied via MCP `apply_migration`)

Touched:

- `src/app/settings.tsx` — add the Feedback section (2 rows)
- `src/app/(modals)/_layout.tsx` — register both routes, `headerShown: false`
- `src/app/(onboarding)/<final>.tsx` — one line above the CTA
- `docs/DEVELOPMENT.md` — Supabase env keys
- `app.json` / env config — expose the two public env vars

---

## 10. Open questions / assumptions

1. **Area chips source** — assumed to be the user's own category names, with a static
   fallback. Confirm during planning (vs. a fixed static list).
2. **Sent glyph** — checkmark for v1; swap to `BeeMascot` if it reads better on device.
3. **Rate limiting** — client queue + a soft server ceiling for v1; server-side per-install
   throttle is a fast-follow if abuse shows up.
4. **"What's new" reach** — it lives in Settings (low traffic by design). If changelog
   views are too low post-launch, revisit surfacing a shipped item elsewhere (out of scope now).
