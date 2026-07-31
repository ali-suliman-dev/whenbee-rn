# Feedback Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private, one-way in-app feedback channel (tag + free text) plus a founder-published read-only "What's new" changelog, backed by Supabase with RLS.

**Architecture:** UI (settings rows, a send `formSheet`, a changelog screen, one onboarding line) → a single `useFeedback` hook → a guarded `services/feedback.ts` that owns the `supabase-js` client → Supabase (`public` schema, `feedback_*` tables, RLS: anon INSERT-only submissions, SELECT-only-published changelog). Submits are optimistic with background retry + a kv offline queue so the free-tier auto-pause never surfaces an error.

**Tech Stack:** Expo SDK 54, expo-router 6, React Native 0.81 (Fabric), Zustand, `@supabase/supabase-js`, `expo-sqlite/kv-store`, Jest.

**Design spec:** `docs/superpowers/specs/2026-07-16-feedback-feature-design.md`
**Approved visual:** `scratchpad/feedback-mock.html` (v2)

## Global Constraints

- **Expo SDK 54 only.** Use `npx expo install <pkg>`, never `npm install`, for native/Expo deps. Then `npx expo-doctor` (expect 18/18).
- **Dev build only** — Expo Go cannot run the app. All device/sim verification uses `npm run ios`.
- **Tokens only.** Every color / spacing / size / font / radius comes from `src/theme/tokens.ts` via `useTheme()`. Never inline a raw hex or number. If a value is missing, add a token.
- **Layer boundary (ESLint-enforced):** `src/app/**` and `src/components/**` must NOT import `src/services/*` or `src/db/*`. Route through the `useFeedback` hook or an existing store.
- **Modal hard-rule:** every sheet uses `headerShown: false` (already supplied by the shared `sheet` options in `src/app/_layout.tsx`), starts with `<SheetGrabber />`, passes `horizontalPadding={false}` to `<Screen>` (the gutter comes from the native `contentStyle`), and anchors its root column to `minHeight: winH * 0.95 - insets.bottom` to pin the footer.
- **Button sizing:** the Send CTA is the default `AppButton` (md). Never `size="lg"`.
- **Animation hard-rule:** entrances fade opacity only — no translate-in, no spring/bounce. Reduced motion → final state.
- **No emoji** in UI. Use Ionicons outline glyphs (`bulb-outline`, `alert-circle-outline`, `heart-outline`, `chatbubble-ellipses-outline`, `sparkles-outline`, `checkmark-circle-outline`), matching `SettingRow`.
- **Security:** the client uses ONLY the Supabase anon/publishable key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`). NEVER the service_role key. RLS is the guard.
- **No PII.** No name, email, or login. Only a random `install_id` (UUID) + `app_version` / `os` / `locale`.
- **Copy is verbatim** from the spec §4 copy table. Do not paraphrase user-facing strings.
- **TDD required** for the logic layer (service, hook, install_id, queue). Write the test first.
- **Every task ends green:** run the affected suite (`npx jest <path>`), then before the final commit run `npm run lint`, `npm run typecheck`, `npm test`.
- **Commits:** Conventional Commits. NEVER add `Co-Authored-By` or any AI-attribution trailer. Do not merge — the founder merges the PR.

---

### Task 1: Database schema + RLS (Supabase)

**This task is provisioning, run by the main agent / founder — NOT the code subagent.** It commits a migration file for the record and applies it to the live project.

**Files:**
- Create: `supabase/migrations/20260716000000_feedback.sql`

**Interfaces:**
- Produces: two tables `public.feedback_submissions` and `public.feedback_changelog`, reachable by the anon key under RLS.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260716000000_feedback.sql
create table if not exists public.feedback_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in ('idea','problem','love')),
  category     text,
  body         text not null check (char_length(body) between 1 and 4000),
  install_id   uuid not null,
  app_version  text,
  os           text,
  locale       text,
  handled      boolean not null default false
);

create table if not exists public.feedback_changelog (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  status        text not null check (status in ('shipped','planned')),
  title         text not null,
  body          text not null,
  is_published  boolean not null default false
);

create index if not exists feedback_changelog_pub_idx
  on public.feedback_changelog (is_published, published_at desc);

alter table public.feedback_submissions enable row level security;
alter table public.feedback_changelog   enable row level security;

create policy feedback_insert on public.feedback_submissions
  for insert to anon with check (
    char_length(body) between 1 and 4000
    and kind in ('idea','problem','love')
  );

create policy changelog_read on public.feedback_changelog
  for select to anon using (is_published = true);
```

- [ ] **Step 2: Apply to the live project**

Apply via the Supabase MCP `apply_migration` (name `feedback`, the SQL above) against project `iptnmqcrmxakwqbaqugs`, or paste into the dashboard SQL editor. The project is free-tier and may be paused — the first call wakes it (retry once after ~10s if it times out).

- [ ] **Step 3: Verify RLS with an anon probe**

Using the anon key (get it via MCP `get_publishable_keys`), confirm:
- INSERT a row into `feedback_submissions` → succeeds.
- SELECT from `feedback_submissions` → returns 0 rows (denied by absent SELECT policy).
- SELECT from `feedback_changelog` → returns only `is_published = true` rows.

Record the outcome in the PR description (this is the security gate).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260716000000_feedback.sql
git commit -m "feat(feedback): add supabase schema + RLS for feedback and changelog"
```

---

### Task 2: Supabase client + config + types

**Files:**
- Create: `src/services/feedbackClient.ts`
- Create: `src/features/feedback/types.ts`
- Modify: `docs/DEVELOPMENT.md` (add the two env vars under the env-setup section)
- Modify: `.env.example` (create if absent)

**Interfaces:**
- Produces:
  - `type FeedbackKind = 'idea' | 'problem' | 'love'`
  - `interface FeedbackInput { kind: FeedbackKind; category?: string; body: string }`
  - `interface ChangelogEntry { id: string; status: 'shipped' | 'planned'; title: string; body: string; publishedAt: string }`
  - `getFeedbackClient(): SupabaseClient | null` — returns a memoized client, or `null` in Expo Go or when env is missing.

- [ ] **Step 1: Install the dependency**

Run: `npx expo install @supabase/supabase-js`
Then: `npx expo-doctor` (expect 18/18).

- [ ] **Step 2: Add env vars to docs and example**

Append to `docs/DEVELOPMENT.md` env section and `.env.example`:

```bash
# Feedback backend (Supabase — anon/publishable key only; RLS is the guard)
EXPO_PUBLIC_SUPABASE_URL=https://iptnmqcrmxakwqbaqugs.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable anon key>
```

- [ ] **Step 3: Write the types**

```typescript
// src/features/feedback/types.ts
export type FeedbackKind = 'idea' | 'problem' | 'love';

export interface FeedbackInput {
  kind: FeedbackKind;
  category?: string;
  body: string;
}

export interface ChangelogEntry {
  id: string;
  status: 'shipped' | 'planned';
  title: string;
  body: string;
  publishedAt: string; // ISO timestamp
}
```

- [ ] **Step 4: Write the guarded client**

```typescript
// src/services/feedbackClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isExpoGo } from '@/src/lib/isExpoGo';

let client: SupabaseClient | null | undefined;

/**
 * Memoized Supabase client for feedback. Returns null in Expo Go or when the
 * env vars are absent, so callers degrade gracefully (never throw at import).
 * Uses the anon/publishable key only — RLS is the security boundary.
 */
export function getFeedbackClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (isExpoGo || !url || !key) {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no new errors.

```bash
git add src/services/feedbackClient.ts src/features/feedback/types.ts docs/DEVELOPMENT.md .env.example package.json package-lock.json
git commit -m "feat(feedback): add guarded supabase client, types, and env config"
```

---

### Task 3: install_id helper

**Files:**
- Create: `src/features/feedback/installId.ts`
- Test: `src/features/feedback/__tests__/installId.test.ts`

**Interfaces:**
- Consumes: `kv` from `@/src/lib/kv` (`kv.set(key, value)`, `kv.getString(key)`).
- Produces: `getInstallId(): string` — mints a UUID once, persists it in kv, returns the same value on every later call.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/feedback/__tests__/installId.test.ts
import { getInstallId } from '../installId';
import { kv } from '@/src/lib/kv';

jest.mock('@/src/lib/kv', () => {
  const store: Record<string, string> = {};
  return {
    kv: {
      set: (k: string, v: string) => { store[k] = v; },
      getString: (k: string) => (k in store ? store[k] : null),
    },
  };
});

describe('getInstallId', () => {
  it('mints once and is stable across calls', () => {
    const a = getInstallId();
    const b = getInstallId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
    expect(a).toBe(b);
    expect(kv.getString('feedback.installId')).toBe(a);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/feedback/__tests__/installId.test.ts`
Expected: FAIL — cannot find module `../installId`.

- [ ] **Step 3: Implement**

```typescript
// src/features/feedback/installId.ts
import 'react-native-get-random-values';
import { kv } from '@/src/lib/kv';

const KEY = 'feedback.installId';

function uuid(): string {
  // crypto.randomUUID is available via react-native-get-random-values polyfill.
  return (globalThis.crypto as Crypto).randomUUID();
}

export function getInstallId(): string {
  const existing = kv.getString(KEY);
  if (existing) return existing;
  const id = uuid();
  kv.set(KEY, id);
  return id;
}
```

If `react-native-get-random-values` is not already a dependency, install it: `npx expo install react-native-get-random-values`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/features/feedback/__tests__/installId.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/feedback/installId.ts src/features/feedback/__tests__/installId.test.ts package.json package-lock.json
git commit -m "feat(feedback): add stable anonymous install id"
```

---

### Task 4: Offline queue

**Files:**
- Create: `src/features/feedback/queue.ts`
- Test: `src/features/feedback/__tests__/queue.test.ts`

**Interfaces:**
- Consumes: `kv`, `FeedbackInput` + `install_id`/metadata payload shape (a `SubmissionPayload`).
- Produces:
  - `type SubmissionPayload = { kind: FeedbackKind; category: string | null; body: string; install_id: string; app_version: string | null; os: string | null; locale: string | null }`
  - `enqueue(p: SubmissionPayload): void`
  - `readQueue(): SubmissionPayload[]`
  - `writeQueue(items: SubmissionPayload[]): void`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/feedback/__tests__/queue.test.ts
import { enqueue, readQueue, writeQueue, type SubmissionPayload } from '../queue';

jest.mock('@/src/lib/kv', () => {
  const store: Record<string, string> = {};
  return { kv: {
    set: (k: string, v: string) => { store[k] = v; },
    getString: (k: string) => (k in store ? store[k] : null),
  }};
});

const p = (body: string): SubmissionPayload => ({
  kind: 'idea', category: null, body, install_id: 'x',
  app_version: null, os: null, locale: null,
});

describe('offline queue', () => {
  it('enqueues and reads back in order', () => {
    enqueue(p('a')); enqueue(p('b'));
    expect(readQueue().map((x) => x.body)).toEqual(['a', 'b']);
  });
  it('writeQueue replaces contents', () => {
    writeQueue([p('c')]);
    expect(readQueue().map((x) => x.body)).toEqual(['c']);
  });
  it('empty when nothing stored', () => {
    writeQueue([]);
    expect(readQueue()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/feedback/__tests__/queue.test.ts`
Expected: FAIL — cannot find module `../queue`.

- [ ] **Step 3: Implement**

```typescript
// src/features/feedback/queue.ts
import { kv } from '@/src/lib/kv';
import type { FeedbackKind } from './types';

const KEY = 'feedback.queue';

export type SubmissionPayload = {
  kind: FeedbackKind;
  category: string | null;
  body: string;
  install_id: string;
  app_version: string | null;
  os: string | null;
  locale: string | null;
};

export function readQueue(): SubmissionPayload[] {
  const raw = kv.getString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SubmissionPayload[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(items: SubmissionPayload[]): void {
  kv.set(KEY, JSON.stringify(items));
}

export function enqueue(p: SubmissionPayload): void {
  writeQueue([...readQueue(), p]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/features/feedback/__tests__/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/feedback/queue.ts src/features/feedback/__tests__/queue.test.ts
git commit -m "feat(feedback): add offline submission queue"
```

---

### Task 5: feedback service — submit + fetch + drain

**Files:**
- Create: `src/services/feedback.ts`
- Test: `src/services/__tests__/feedback.test.ts`

**Interfaces:**
- Consumes: `getFeedbackClient()`, `getInstallId()`, `enqueue`/`readQueue`/`writeQueue`, `FeedbackInput`, `ChangelogEntry`.
- Produces:
  - `submitFeedback(input: FeedbackInput): Promise<void>` — builds the payload (input + install_id + app version/os/locale), inserts into `feedback_submissions`, retries up to 3× with backoff, enqueues on final failure. Never throws.
  - `fetchChangelog(): Promise<ChangelogEntry[]>` — selects published rows ordered by `published_at desc`, maps to `ChangelogEntry`. Returns `[]` on any failure or when the client is null.
  - `drainQueue(): Promise<void>` — attempts each queued payload once; keeps failures in the queue.

**Note on metadata:** use `expo-application` (`nativeApplicationVersion`) for `app_version`, `Platform.OS` for `os`, and `expo-localization` (`getLocales()[0]?.languageTag`) for `locale`. These are already common Expo deps; if `expo-localization` is missing, install with `npx expo install expo-localization`. In tests, mock them.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/services/__tests__/feedback.test.ts
import { submitFeedback, fetchChangelog } from '../feedback';

const insert = jest.fn();
const order = jest.fn();
const eq = jest.fn(() => ({ order }));
const select = jest.fn(() => ({ eq }));
const from = jest.fn(() => ({ insert, select }));

jest.mock('../feedbackClient', () => ({ getFeedbackClient: () => ({ from }) }));
jest.mock('@/src/features/feedback/installId', () => ({ getInstallId: () => 'install-1' }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3' }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const enqueue = jest.fn();
jest.mock('@/src/features/feedback/queue', () => ({
  enqueue: (...a: unknown[]) => enqueue(...a),
  readQueue: () => [],
  writeQueue: () => {},
}));

beforeEach(() => { jest.clearAllMocks(); });

describe('submitFeedback', () => {
  it('inserts the full payload on success', async () => {
    insert.mockResolvedValue({ error: null });
    await submitFeedback({ kind: 'idea', category: 'Timer', body: 'hello' });
    expect(from).toHaveBeenCalledWith('feedback_submissions');
    expect(insert).toHaveBeenCalledWith({
      kind: 'idea', category: 'Timer', body: 'hello',
      install_id: 'install-1', app_version: '1.2.3', os: 'ios', locale: 'en-US',
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues after repeated failure and never throws', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } });
    await expect(submitFeedback({ kind: 'love', body: 'x' })).resolves.toBeUndefined();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});

describe('fetchChangelog', () => {
  it('maps published rows to ChangelogEntry', async () => {
    order.mockResolvedValue({ data: [
      { id: '1', status: 'shipped', title: 'T', body: 'B', published_at: '2026-07-14T00:00:00Z' },
    ], error: null });
    const rows = await fetchChangelog();
    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('is_published', true);
    expect(rows).toEqual([
      { id: '1', status: 'shipped', title: 'T', body: 'B', publishedAt: '2026-07-14T00:00:00Z' },
    ]);
  });

  it('returns [] on error', async () => {
    order.mockResolvedValue({ data: null, error: { message: 'nope' } });
    expect(await fetchChangelog()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/services/__tests__/feedback.test.ts`
Expected: FAIL — cannot find module `../feedback`.

- [ ] **Step 3: Implement**

```typescript
// src/services/feedback.ts
import { Platform } from 'react-native';
import { nativeApplicationVersion } from 'expo-application';
import { getLocales } from 'expo-localization';
import { getFeedbackClient } from './feedbackClient';
import { getInstallId } from '@/src/features/feedback/installId';
import { enqueue, readQueue, writeQueue, type SubmissionPayload } from '@/src/features/feedback/queue';
import type { FeedbackInput, ChangelogEntry } from '@/src/features/feedback/types';

const MAX_ATTEMPTS = 3;

function buildPayload(input: FeedbackInput): SubmissionPayload {
  return {
    kind: input.kind,
    category: input.category ?? null,
    body: input.body,
    install_id: getInstallId(),
    app_version: nativeApplicationVersion ?? null,
    os: Platform.OS,
    locale: getLocales()[0]?.languageTag ?? null,
  };
}

async function tryInsert(payload: SubmissionPayload): Promise<boolean> {
  const client = getFeedbackClient();
  if (!client) return false;
  const { error } = await client.from('feedback_submissions').insert(payload);
  return !error;
}

async function insertWithRetry(payload: SubmissionPayload): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (await tryInsert(payload)) return true;
    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, attempt * 400));
    }
  }
  return false;
}

/** Fire-and-forget. Optimistic UI has already confirmed; never throws. */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const payload = buildPayload(input);
  const ok = await insertWithRetry(payload);
  if (!ok) enqueue(payload);
}

export async function fetchChangelog(): Promise<ChangelogEntry[]> {
  const client = getFeedbackClient();
  if (!client) return [];
  const { data, error } = await client
    .from('feedback_changelog')
    .select('id,status,title,body,published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    status: r.status as ChangelogEntry['status'],
    title: String(r.title),
    body: String(r.body),
    publishedAt: String(r.published_at),
  }));
}

/** Best-effort drain; keeps anything still failing in the queue. */
export async function drainQueue(): Promise<void> {
  const items = readQueue();
  if (items.length === 0) return;
  const remaining: SubmissionPayload[] = [];
  for (const item of items) {
    const ok = await tryInsert(item);
    if (!ok) remaining.push(item);
  }
  writeQueue(remaining);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/services/__tests__/feedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/feedback.ts src/services/__tests__/feedback.test.ts package.json package-lock.json
git commit -m "feat(feedback): add submit/fetch/drain service with retry"
```

---

### Task 6: useFeedback hook

**Files:**
- Create: `src/features/feedback/useFeedback.ts`
- Test: `src/features/feedback/__tests__/useFeedback.test.ts`

**Interfaces:**
- Consumes: `submitFeedback`, `fetchChangelog`, `drainQueue`, `ChangelogEntry`, `FeedbackInput`, `kv`.
- Produces a hook returning:
  - `submit(input: FeedbackInput): Promise<void>` (calls `submitFeedback`)
  - `changelog: ChangelogEntry[]`, `loading: boolean`, `loadChangelog(): Promise<void>`
  - `hasUnread: boolean` (true iff any `changelog[i].publishedAt > kv 'feedback.changelog.lastSeenAt'`)
  - `markChangelogSeen(): void` (sets lastSeenAt to the newest publishedAt)
- Also exports the pure helper `computeHasUnread(entries: ChangelogEntry[], lastSeenAt: string | null): boolean` for direct unit testing.

- [ ] **Step 1: Write the failing test (pure helper first)**

```typescript
// src/features/feedback/__tests__/useFeedback.test.ts
import { computeHasUnread } from '../useFeedback';
import type { ChangelogEntry } from '../types';

const e = (id: string, publishedAt: string): ChangelogEntry =>
  ({ id, status: 'shipped', title: 't', body: 'b', publishedAt });

describe('computeHasUnread', () => {
  const list = [e('1', '2026-07-14T00:00:00Z'), e('2', '2026-07-02T00:00:00Z')];
  it('true when nothing seen yet', () => {
    expect(computeHasUnread(list, null)).toBe(true);
  });
  it('true when a newer entry exists', () => {
    expect(computeHasUnread(list, '2026-07-10T00:00:00Z')).toBe(true);
  });
  it('false when all seen', () => {
    expect(computeHasUnread(list, '2026-07-14T00:00:00Z')).toBe(false);
  });
  it('false for empty list', () => {
    expect(computeHasUnread([], null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/features/feedback/__tests__/useFeedback.test.ts`
Expected: FAIL — cannot find module `../useFeedback`.

- [ ] **Step 3: Implement**

```typescript
// src/features/feedback/useFeedback.ts
import { useCallback, useEffect, useState } from 'react';
import { kv } from '@/src/lib/kv';
import { submitFeedback, fetchChangelog, drainQueue } from '@/src/services/feedback';
import type { ChangelogEntry, FeedbackInput } from './types';

const SEEN_KEY = 'feedback.changelog.lastSeenAt';

export function computeHasUnread(entries: ChangelogEntry[], lastSeenAt: string | null): boolean {
  if (entries.length === 0) return false;
  const newest = entries.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
  if (!lastSeenAt) return true;
  return newest > lastSeenAt;
}

export function useFeedback() {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => kv.getString(SEEN_KEY));

  const submit = useCallback((input: FeedbackInput) => submitFeedback(input), []);

  const loadChangelog = useCallback(async () => {
    setLoading(true);
    const rows = await fetchChangelog();
    setChangelog(rows);
    setLoading(false);
  }, []);

  const markChangelogSeen = useCallback(() => {
    const newest = changelog.reduce((m, e) => (e.publishedAt > m ? e.publishedAt : m), '');
    if (newest) {
      kv.set(SEEN_KEY, newest);
      setLastSeenAt(newest);
    }
  }, [changelog]);

  // Drain any queued submissions once on mount (best-effort).
  useEffect(() => { void drainQueue(); }, []);

  return {
    submit,
    changelog,
    loading,
    loadChangelog,
    hasUnread: computeHasUnread(changelog, lastSeenAt),
    markChangelogSeen,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/features/feedback/__tests__/useFeedback.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/feedback/useFeedback.ts src/features/feedback/__tests__/useFeedback.test.ts
git commit -m "feat(feedback): add useFeedback hook with unread-changelog logic"
```

---

### Task 7: Send feedback sheet + route

**Files:**
- Create: `src/app/(modals)/feedback.tsx`
- Modify: `src/app/_layout.tsx` (register the route with the shared `sheet` options — add after line 174, alongside the other `sheet` screens)

**Interfaces:**
- Consumes: `useFeedback().submit`, `useCategoriesStore` (existing) for area chips, `Chip`, `AppButton`, `SheetGrabber`, `Screen`, `useTheme`, `type` roles.
- Produces: the route `(modals)/feedback`.

**Reference patterns:** copy the sheet skeleton from `src/app/(modals)/add-task.tsx` (SheetGrabber, `horizontalPadding={false}`, `minHeight: winH * 0.95 - insets.bottom`, `TaskTitleField` autofocus pattern). Chip is single-select controlled by parent state. Copy strings verbatim from spec §4.

- [ ] **Step 1: Register the route**

In `src/app/_layout.tsx`, after the existing `sheet` screens (after line 174):

```tsx
<Stack.Screen name="(modals)/feedback" options={sheet} />
<Stack.Screen name="(modals)/whats-new" options={sheet} />
```

- [ ] **Step 2: Build the sheet**

```tsx
// src/app/(modals)/feedback.tsx
import { useState } from 'react';
import { View, TextInput, useWindowDimensions, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { AppButton } from '@/src/components/AppButton';
import { Chip } from '@/src/components/Chip';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useCategoriesStore } from '@/src/stores/categoriesStore';
import { useFeedback } from '@/src/features/feedback/useFeedback';
import type { FeedbackKind } from '@/src/features/feedback/types';

const KINDS: { value: FeedbackKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'idea', label: 'Idea', icon: 'bulb-outline' },
  { value: 'problem', label: 'Problem', icon: 'alert-circle-outline' },
  { value: 'love', label: 'Love', icon: 'heart-outline' },
];

export default function FeedbackSheet() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { submit } = useFeedback();
  const categories = useCategoriesStore((s) => s.categories);
  const areaOptions = categories.length > 0 ? categories.map((c) => c.name) : ['Timer', 'Calibration', 'Planning', 'Other'];

  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = kind !== null && body.trim().length > 0;

  function handleSend() {
    if (!canSend || kind === null) return;
    void submit({ kind, category: area ?? undefined, body: body.trim() });
    setSent(true);
  }

  return (
    <Screen horizontalPadding={false} edges={['left', 'right']}>
      <SheetGrabber />
      <View style={{ minHeight: winH * 0.95 - insets.bottom, paddingHorizontal: t.space[5], paddingBottom: insets.bottom + t.space[5] }}>
        {sent ? (
          <SentState onDone={() => router.back()} />
        ) : (
          <>
            <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink, marginBottom: t.space[1] }}>
              Tell me what to build
            </AppText>
            <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft, marginBottom: t.space[5] }}>
              It's just me building Whenbee. Your note comes straight to me.
            </AppText>

            <AppText variant="label" style={{ marginBottom: t.space[2] }}>What kind?</AppText>
            <View style={{ flexDirection: 'row', gap: t.space[2], marginBottom: t.space[5] }}>
              {KINDS.map((k) => (
                <Chip
                  key={k.value}
                  label={k.label}
                  selected={kind === k.value}
                  onPress={() => setKind(k.value)}
                  icon={<Ionicons name={k.icon} size={t.iconSize.sm} color={kind === k.value ? t.colors.primary : t.colors.inkSoft} />}
                />
              ))}
            </View>

            <AppText variant="label" style={{ marginBottom: t.space[2] }}>About (optional)</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space[2], marginBottom: t.space[5] }}>
              {areaOptions.map((a) => (
                <Chip key={a} label={a} selected={area === a} onPress={() => setArea(area === a ? null : a)} />
              ))}
            </View>

            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="A rough idea, something that bugged you, or what's working…"
              placeholderTextColor={t.colors.inkFaint}
              multiline
              maxLength={4000}
              style={{
                minHeight: 120, backgroundColor: t.colors.surfaceSunken, borderRadius: t.radii.md,
                borderCurve: 'continuous', padding: t.space[4], color: t.colors.ink,
                ...(type.body as TextStyle),
              }}
            />

            <View style={{ flex: 1 }} />
            <AppButton label="Send" onPress={handleSend} disabled={!canSend} fullWidth />
          </>
        )}
      </View>
    </Screen>
  );
}

function SentState({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], paddingBottom: t.space[16] }}>
      <Ionicons name="checkmark-circle-outline" size={t.iconSize.xl * 2} color={t.colors.accent} />
      <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink }}>Got it. Thank you.</AppText>
      <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft, textAlign: 'center', maxWidth: 260 }}>
        That came straight to me. When it turns into something, you'll see it under What's new.
      </AppText>
      <View style={{ flex: 1 }} />
      <AppButton label="Done" onPress={onDone} variant="ghost" />
    </View>
  );
}
```

> Note: verify `type.title`/`type.body` cast style. If `AppText` supports a `variant` prop for these roles, prefer `variant`. Match how `add-task.tsx` renders its title. Confirm `AppButton` has a `ghost` variant (it does — see `AppButton.tsx`); if the Done affordance should auto-dismiss, add a `setTimeout(onDone, t.motion.toast * 7)` guarded by an unmount cleanup — optional, keep v1 as a manual Done.

- [ ] **Step 3: Verify on the simulator**

Run: `npm run ios`, then deep-link: `xcrun simctl openurl booted "whenbee:///feedback"`. Confirm: header-less sheet, grabber, gutter present, Send disabled until a kind + text, tapping Send shows the Sent state.

- [ ] **Step 4: Lint + typecheck + commit**

Run: `npx eslint src/app/(modals)/feedback.tsx && npm run typecheck`

```bash
git add "src/app/(modals)/feedback.tsx" src/app/_layout.tsx
git commit -m "feat(feedback): add send-feedback sheet and route"
```

---

### Task 8: What's new changelog screen

**Files:**
- Create: `src/app/(modals)/whats-new.tsx`
- (Route already registered in Task 7 Step 1.)

**Interfaces:**
- Consumes: `useFeedback()` (`changelog`, `loading`, `loadChangelog`, `markChangelogSeen`), `Screen`, `SheetGrabber`, `AppText`, `useTheme`, `type`.
- Produces: the route `(modals)/whats-new`.

- [ ] **Step 1: Build the screen**

```tsx
// src/app/(modals)/whats-new.tsx
import { useEffect } from 'react';
import { View, ScrollView, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { SheetGrabber } from '@/src/components/SheetGrabber';
import { AppText } from '@/src/components/AppText';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import { useFeedback } from '@/src/features/feedback/useFeedback';
import type { ChangelogEntry } from '@/src/features/feedback/types';

export default function WhatsNew() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { changelog, loading, loadChangelog, markChangelogSeen } = useFeedback();

  useEffect(() => { void loadChangelog(); }, [loadChangelog]);
  // Mark seen when leaving the screen.
  useEffect(() => () => markChangelogSeen(), [markChangelogSeen]);

  return (
    <Screen horizontalPadding={false} edges={['left', 'right']}>
      <SheetGrabber />
      <ScrollView contentContainerStyle={{ paddingHorizontal: t.space[5], paddingBottom: insets.bottom + t.space[6], gap: t.space[3] }}>
        <AppText style={{ ...(type.title as TextStyle), color: t.colors.ink, marginBottom: t.space[2] }}>What's new</AppText>
        {changelog.length === 0 && !loading ? (
          <AppText style={{ ...(type.body as TextStyle), color: t.colors.inkSoft }}>Nothing new yet.</AppText>
        ) : (
          changelog.map((e) => <ChangelogCard key={e.id} entry={e} />)
        )}
      </ScrollView>
    </Screen>
  );
}

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const t = useTheme();
  const shipped = entry.status === 'shipped';
  return (
    <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radii.card, borderCurve: 'continuous', padding: t.space[4], gap: t.space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
        <View style={{ backgroundColor: shipped ? t.colors.accentChip : t.colors.primaryChip, borderRadius: t.radii.full, paddingHorizontal: t.space[2], paddingVertical: t.space[0.5] }}>
          <AppText style={{ ...(type.eyebrowSm as TextStyle), color: shipped ? t.colors.amberText : t.colors.primary }}>
            {shipped ? 'Shipped' : 'Planned'}
          </AppText>
        </View>
      </View>
      <AppText style={{ ...(type.bodySmBold as TextStyle), color: t.colors.ink }}>{entry.title}</AppText>
      <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkSoft }}>{entry.body}</AppText>
    </View>
  );
}
```

- [ ] **Step 2: Verify on the simulator**

Run: `xcrun simctl openurl booted "whenbee:///whats-new"`. With no published rows it shows "Nothing new yet." Publish a test row from the Supabase dashboard and re-open to see a card.

- [ ] **Step 3: Lint + typecheck + commit**

Run: `npx eslint "src/app/(modals)/whats-new.tsx" && npm run typecheck`

```bash
git add "src/app/(modals)/whats-new.tsx"
git commit -m "feat(feedback): add What's new changelog screen"
```

---

### Task 9: Settings rows

**Files:**
- Modify: `src/app/settings.tsx` (add a Feedback section between "Your data" (ends ~line 586) and "Presence"/"Account")

**Interfaces:**
- Consumes: existing `SettingRow` (in-file), `router`, `useFeedback().hasUnread`.

- [ ] **Step 1: Read unread state at the top of `Settings()`**

Add near the other hook calls:

```tsx
const { hasUnread } = useFeedback();
```
(import: `import { useFeedback } from '@/src/features/feedback/useFeedback';`)

- [ ] **Step 2: Add the Feedback section** (after the "Your data" `</View>`):

```tsx
<View style={{ gap: t.space[3] }}>
  <AppText variant="label">Feedback</AppText>
  <SettingRow
    icon="chatbubble-ellipses-outline"
    title="Send feedback"
    note="An idea, a snag, or what's working. Comes straight to me."
    onPress={() => router.push('/(modals)/feedback')}
  />
  <SettingRow
    icon="sparkles-outline"
    tint={t.colors.accent}
    title="What's new"
    note="What you asked for, and what I shipped."
    onPress={() => router.push('/(modals)/whats-new')}
    trailing={
      hasUnread ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space[2] }}>
          <View style={{ width: t.space[2.5], height: t.space[2.5], borderRadius: t.radii.full, backgroundColor: t.colors.accent }} />
          <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.inkSoft} />
        </View>
      ) : undefined
    }
  />
</View>
```

- [ ] **Step 3: Verify + lint + typecheck + commit**

Run: `npm run ios`, open Settings, confirm the Feedback section and that "What's new" shows a dot only when an unseen published entry exists.
Run: `npx eslint src/app/settings.tsx && npm run typecheck`

```bash
git add src/app/settings.tsx
git commit -m "feat(feedback): add Feedback section to settings"
```

---

### Task 10: Onboarding line

**Files:**
- Modify: `src/app/(onboarding)/ready.tsx` (add one line above the CTA `Reveal` at index 5, line ~152)

**Interfaces:**
- Consumes: existing `Reveal`, `AppText`, `useTheme`, `type`.

- [ ] **Step 1: Add the line**

Insert a new `Reveal` immediately before the CTA `Reveal index={5}` block. Bump the CTA to `index={6}`:

```tsx
<Reveal index={5}>
  <AppText style={{ ...(type.caption as TextStyle), color: t.colors.inkSoft, textAlign: 'center' }}>
    <AppText style={{ ...(type.captionBold as TextStyle), color: t.colors.ink }}>Made by one person. </AppText>
    Tell me what to add anytime, it's in Settings.
  </AppText>
</Reveal>
<Reveal index={6} style={{ paddingTop: t.space[4] }}>
  <AppButton label="Time my first thing →" fullWidth onPress={timeFirstThing} />
</Reveal>
```

(Confirm `type` and `TextStyle` are imported in `ready.tsx`; add if missing.)

- [ ] **Step 2: Verify on the simulator**

Restart onboarding (delete the app data container per CLAUDE.md, relaunch) or deep-link `whenbee:///(onboarding)/ready`. Confirm the line sits above the CTA, fades in with the stagger, no layout break.

- [ ] **Step 3: Lint + typecheck + commit**

Run: `npx eslint "src/app/(onboarding)/ready.tsx" && npm run typecheck`

```bash
git add "src/app/(onboarding)/ready.tsx"
git commit -m "feat(feedback): mention feedback on the onboarding final screen"
```

---

### Task 11: Full verification + PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full gate**

Run, in order, and fix anything that fails:
- `npm run lint`
- `npm run typecheck`
- `npm test`

- [ ] **Step 2: Manual end-to-end on the sim**

`npm run ios`. Send a real feedback note (Idea + text) → confirm the Sent state. In the Supabase dashboard, confirm the row landed in `feedback_submissions` with `install_id`/version/os/locale and NO PII. Publish a `feedback_changelog` row (`is_published = true`) → open "What's new" → card shows, Settings dot clears after viewing.

- [ ] **Step 3: Open the PR (do NOT merge)**

```bash
git push -u origin <branch>
gh pr create --base main --title "feat: private feedback channel + What's new changelog" --body "<summary + the RLS anon-probe result from Task 1 Step 3 + manual E2E result>"
```

Stop after opening the PR. The founder reviews and merges.

---

## Self-Review

**Spec coverage:**
- Model / private one-way → whole plan (no board/votes). ✓
- Send sheet (tag + area + text, optimistic) → Task 7 + service Task 5. ✓
- What's new changelog + unread dot → Tasks 6, 8, 9. ✓
- Settings placement → Task 9. ✓
- Onboarding line → Task 10. ✓
- Anonymous install_id + metadata, no PII → Tasks 3, 5. ✓
- Supabase public schema + `feedback_*` + RLS → Task 1. ✓
- Guarded client, anon key only, isExpoGo → Task 2. ✓
- Optimistic + retry + offline queue → Tasks 4, 5, 6. ✓
- Copy verbatim → Tasks 7–10 (from spec §4). ✓
- Config/env → Task 2. ✓
- TDD logic layer → Tasks 3–6. ✓

**Placeholder scan:** no TBD/TODO; all code shown; the one "verify AppText variant" note in Task 7 is a concrete check against `add-task.tsx`, not a deferral.

**Type consistency:** `FeedbackKind`/`FeedbackInput`/`ChangelogEntry` defined in Task 2 and used unchanged in 5/6/7/8. `SubmissionPayload` defined in Task 4, consumed in 5. `computeHasUnread(entries, lastSeenAt)` defined + tested in Task 6. Route names `(modals)/feedback` and `(modals)/whats-new` registered in Task 7, pushed in Task 9. Consistent.

---

## Execution Handoff

Execution: **subagent-driven** in an isolated git worktree, one PR to main (never merged). Task 1 (DB provisioning) is run by the main agent, not the code subagent. Branch name confirmed with the founder before creation.
