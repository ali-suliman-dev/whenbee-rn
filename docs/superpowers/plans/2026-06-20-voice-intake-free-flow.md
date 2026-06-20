# Voice Intake (Free Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user tap a mic on any task-name field, speak a task ("write that email I keep meaning to send to Frederick"), and get a clean, editable task title in the field — fully on-device — which the app's existing logic turns into a category + their honest estimate.

**Architecture:** Voice is a second *input method* for the task title, nothing more. A shared `TaskTitleField` (input + mic) replaces the three raw `TextInput`s. The mic drives a feature hook `useVoiceCapture` → on-device STT service → a tiered structurer (Tier-2 Apple on-device LLM if available, else Tier-1 pure rules) that returns a cleaned **title string**. That string is handed to the field's existing `onChangeText`, so the app's proven `guessCategory` + honest-suggestion cascade fills category and estimate with zero new logic. A thin `OnDeviceLlm` interface wraps the Apple LLM library so the vendor can be swapped in one file as more AI features land.

**Tech Stack:** Expo SDK 54 · RN 0.81.5 (New Arch on) · React 19.1 · `expo-speech-recognition` (jamsch, on-device STT) · `react-native-apple-llm` (deveix, Apple Foundation Models, behind our own `OnDeviceLlm` adapter) · `expo-symbols` (SF Symbol mic glyph, already a dep) · `react-native-reanimated` v4 · Zustand · Jest.

## Global Constraints

_Every task's requirements implicitly include this section. Values copied verbatim from `CLAUDE.md`, `AGENTS.md`, and `docs/product/09-VOICE-HYBRID-BUILD-PLAN.md`._

- **Core loop is on-device-only.** No network call in guess → timer → learn. STT forced on-device (`requiresOnDeviceRecognition: true`); LLM is Apple's on-device model. **No cloud STT, no cloud LLM, ever.**
- **No guilt, ever.** No streaks/shame. Honey/sharpness monotonic. Voice is **always optional**; typing stays first-class.
- **Pricing read from RevenueCat, never hardcoded.** (Not touched in this plan — free flow only.)
- **Expo SDK 54 docs only:** https://docs.expo.dev/versions/v54.0.0/ — never a newer URL.
- **Dev build only.** Expo Go cannot run native modules. Use `npm run ios`. All native code is guarded by `src/lib/isExpoGo.ts` and degrades gracefully.
- **Install Expo/RN deps with `npx expo install`** (not `npm install`), then `npx expo-doctor` (expect 18/18 — may become 19/19 / 20/20 as packages are added; the requirement is **0 issues**).
- **Native config via config plugins in `app.json`** — `ios/`/`android/` are gitignored (CNG). Regenerate with `npx expo prebuild --clean`. Never set `ios.icon` to a `.icon` file.
- **Every spacing/size/font/color value comes from a theme token** in `src/theme/tokens.ts` via `useTheme()`. New token group → add a matching line in `useTheme`'s `resolveTheme` or `t.<key>` is undefined. Never inline a raw number/hex.
- **`reactCompiler` + nativewind gotcha:** `style={({ pressed }) => …}` on `Pressable` silently renders nothing. Keep `Pressable` a bare touch wrapper; put visuals on an inner `View`. Reanimated shared values use `.get()/.set()`, never `.value`.
- **Reanimated:** entering-only animations (no `exiting` on conditionally-unmounted views → Fabric SIGABRT). Animate transform/opacity only. Worklet helpers need `'worklet';`.
- **Footers/sheet bottoms add `useSafeAreaInsets().bottom`.**
- **Layer/ESLint boundaries:** `src/app/**` and `src/components/**` must NOT import `@/src/services/*` or `@/src/db/*`. Route through a store/provider/feature hook. Pure logic (parser) has no React/RN/Expo/clock import.
- **Commits:** Conventional Commits. **No** `Co-Authored-By` / AI-attribution trailers (project policy). Use the `/init-cmt` skill. **Never merge** — open the PR and stop.
- **Verify before done:** `npm run lint && npm run typecheck && npm test` must pass; after editing specific files, `npx eslint <files>`.
- **Mandatory skills when building** (invoke before each matching change): `typescript-expert` (types) · `react-native-expert` + `vercel-react-native-skills` (screens/hooks/perf) · `clean-code` + `coding-standards` + `software-architecture` (every file) · `ui-design:react-native-design` + `ui-design:visual-design-foundations` + `ui-design:mobile-ios-design` + `ui-design:interaction-design` + `ux-principles` (every design/interaction value) · `creating-reanimated-animations` + `motion-design` (mic pulse / sheet) · `conversion-psychology` + `humanizer` (every user-facing string) · Context7 MCP for every native package API before writing a wrapper. UI is approved by the founder from rendered sim screenshots only.

---

## File Structure

**New files**

| Path | Responsibility |
|---|---|
| `src/domain/types.ts` *(modify)* | Add `ParsedTaskDraft` + `VoiceStructuringSource` contract. |
| `src/features/voice/parsing/spokenTaskParser.ts` | PURE Tier-1: ramble → cleaned imperative title. No RN/clock. |
| `src/features/voice/parsing/parserConstants.ts` | Preamble/filler phrase lists (no magic strings). |
| `src/features/voice/parsing/__tests__/spokenTaskParser.test.ts` | Exhaustive TDD fixtures. |
| `src/services/ai/onDeviceLlm.ts` | `OnDeviceLlm` interface + `AiAvailability` type (our vendor-neutral contract). |
| `src/services/ai/appleLlmProvider.ts` | Adapter: `react-native-apple-llm` → `OnDeviceLlm`. `isExpoGo`-guarded. **Only file that imports the vendor lib.** |
| `src/services/ai/index.ts` | `getOnDeviceLlm()` singleton accessor. |
| `src/services/voice/speechRecognition.ts` | `expo-speech-recognition` wrapper: permission, on-device start/stop, event subscriptions. `isExpoGo`-guarded. |
| `src/services/voice/spokenTaskStructurer.ts` | Tier-2: prompt + JSON schema → `OnDeviceLlm` → `ParsedTaskDraft`. Falls back to Tier-1 on unavailable/error. |
| `src/services/voice/__tests__/spokenTaskStructurer.test.ts` | Tiering + fallback branches (LLM mocked). |
| `src/features/voice/useVoiceCapture.ts` | Orchestration: permission → STT → partials → structure() → draft. |
| `src/features/voice/__tests__/useVoiceCapture.test.ts` | Permission-denied, partial→final, fallback path (services mocked). |
| `src/components/TaskTitleField.tsx` | Shared task-title input + trailing mic. Controlled (`value`/`onChangeText`). `variant: 'boxed' | 'underline'`. |
| `src/components/voice/MicButton.tsx` | SF-Symbol mic affordance (bare Pressable + inner View, haptic). |
| `src/components/voice/ListeningSheet.tsx` | Bottom sheet: live partials + pulse + Stop. Entering-only, safe-area. |
| `src/theme/tokens.ts` *(modify)* | Add any missing tokens the components need (see Task 5). |
| `app.json` *(modify)* | `expo-speech-recognition` config plugin + permission strings. |

**Modified screens (refactor to `TaskTitleField`)**

| Path | Change |
|---|---|
| `src/app/(modals)/add-task.tsx:131-142` | Replace title `TextInput` with `<TaskTitleField variant="boxed" .../>`. |
| `src/features/planner/BuildView.tsx:214-225` | Replace InlineComposer `TextInput` with `<TaskTitleField variant="underline" .../>`. |
| `src/app/(modals)/retro.tsx:62-69` | Replace description `TextInput` with `<TaskTitleField variant="boxed" .../>`. |

**Out of scope (separate plans):** Pro multi-task ramble split, hands-free Siri/widget capture (rides unbuilt `WhenbeePresence`), voice retro speak-back, TTS. Category-rename and companion-name inputs are **not** task-name fields and get no mic.

---

## Design spec for the mic + voice surfaces

_Grounded in `src/theme/tokens.ts` (from the codebase audit) + iOS HIG. The implementer still invokes the `ui-design:*` skills before finalizing and screenshot-verifies on the sim._

- **Mic glyph:** `expo-symbols` `SymbolView` (already a dep — native SF Symbols, correct iOS feel). Idle `name="mic"` tint `t.colors.inkSoft`; active `name="mic.fill"` tint `t.colors.primary`. Glyph 20pt (`t.iconSize.md` — add if absent), tap target ≥44pt via `hitSlop`.
- **Placement:** trailing-inside the field, right edge, vertically centered to text cap-height (`alignItems:'center'`), mirroring the existing edit-icon affordance in `add-task.tsx`. In `underline` variant it sits to the right of the baseline rule.
- **Press feedback:** bare `Pressable` wrapper; inner `View` scales to 0.92 on press via Reanimated (transform only), spring back (`t.motion.spring`). `haptics.light()` on press (existing `src/services/haptics` — invoked via the hook, not the component, to respect layer rules; or via an allowed haptics util). No color/shadow change beyond glyph swap.
- **Listening sheet:** bottom-anchored card, `t.colors.surface`, `t.radii.sheet`, hairline top border. Shows live partial transcript (`t.colors.inkSoft`, `t.fontSize.md`), a pulsing concentric ring behind the mic (opacity 0.4→0, scale 1→1.6, looped, **entering-only**, transform/opacity only, `'worklet';` helpers), and a single `Stop` `AppButton variant="ghost"`. Bottom padding `+ useSafeAreaInsets().bottom`. No guilt copy.
- **Copy (through `conversion-psychology` + `humanizer`, no-guilt):** mic a11y label "Speak your task"; sheet title "Listening…"; permission primer (Task 0) "Speak a task instead of typing — your voice is transcribed on your phone and never leaves it." Empty/!match: "Didn't catch that — tap to try again or just type."

---

## Task 0: Packages, config plugin & permissions

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.json:37-67` (plugins array)

**Interfaces:**
- Produces: installed `expo-speech-recognition` + `react-native-apple-llm`; `ExpoSpeechRecognitionModule` available natively; mic/speech Info.plist strings present.

- [ ] **Step 1: Install the STT package**

Run: `npx expo install expo-speech-recognition`

- [ ] **Step 2: Install the Apple LLM package**

`react-native-apple-llm` is not an Expo-managed package but is New-Arch compatible. Install and let CNG autolink:

Run: `npx expo install react-native-apple-llm` (falls back to npm resolution; if it errors, `npm install react-native-apple-llm`)

- [ ] **Step 3: Add the STT config plugin + permission strings to `app.json`**

Add to `expo.plugins` (copy verbatim — strings pass the no-guilt + brand voice rules):

```jsonc
[
  "expo-speech-recognition",
  {
    "microphonePermission": "Whenbee uses the mic so you can speak a task instead of typing.",
    "speechRecognitionPermission": "Speech is transcribed on your device — it never leaves your phone."
  }
]
```

- [ ] **Step 4: Regenerate native projects**

Run: `npx expo prebuild --clean`
Then: `npx expo-doctor`
Expected: **0 issues** (count may rise from 18 checks; all must pass).

- [ ] **Step 5: Build & smoke-test boot**

Run: `npm run ios`
Expected: app boots on the sim with no red screen (native modules link; nothing wired yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: add on-device STT + Apple LLM packages and STT config plugin"
```

---

## Task 1: `ParsedTaskDraft` contract + parser constants

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/features/voice/parsing/parserConstants.ts`

**Interfaces:**
- Produces:
  - `type VoiceStructuringSource = 'appleLLM' | 'rules'`
  - `interface ParsedTaskDraft { title: string; rawTranscript: string; source: VoiceStructuringSource }`
  - `PREAMBLE_PATTERNS: readonly RegExp[]`, `FILLER_WORDS: ReadonlySet<string>`, `MAX_TITLE_WORDS: number`

- [ ] **Step 1: Add the domain type**

In `src/domain/types.ts`, append (keep near other task types):

```ts
/** Where a spoken task's structuring came from. */
export type VoiceStructuringSource = 'appleLLM' | 'rules';

/**
 * One draft task produced from a voice utterance. Free flow yields exactly one.
 * The draft carries only a cleaned title + provenance; category + honest estimate
 * are derived downstream by the field's existing onChangeText cascade (guessCategory
 * + honest suggestion), so nothing here duplicates the engine.
 */
export interface ParsedTaskDraft {
  /** Cleaned, imperative task title, e.g. "Write email to Frederick". */
  title: string;
  /** The raw STT transcript, always kept so the draft stays editable/inspectable. */
  rawTranscript: string;
  source: VoiceStructuringSource;
}
```

- [ ] **Step 2: Create parser constants**

`src/features/voice/parsing/parserConstants.ts`:

```ts
// Phrase lists for the Tier-1 spoken-task parser. No magic strings live in the
// parser itself — tune cleanup behavior here. Pure data, no imports.

/**
 * Leading "I was going to / remind me to …" preambles stripped from the front of
 * an utterance. Anchored to start, case-insensitive, each consumes trailing space.
 */
export const PREAMBLE_PATTERNS: readonly RegExp[] = [
  /^i (?:need|want|have|would like|wanted|was going|am going|keep meaning) to\s+/i,
  /^i(?:'?d| would) like to\s+/i,
  /^i was thinking (?:about|of)\s+/i,
  /^(?:can you |could you |please )?remind me to\s+/i,
  /^(?:i should|let me|gotta|got to|i gotta)\s+/i,
  /^(?:my task is|task:|todo:?|to do:?)\s+/i,
];

/** Filler tokens dropped anywhere in the utterance (lowercased match). */
export const FILLER_WORDS: ReadonlySet<string> = new Set([
  'um', 'uh', 'erm', 'like', 'basically', 'actually', 'just', 'really',
  'kinda', 'sorta', 'maybe', 'somehow', 'literally',
]);

/** Soft cap on cleaned title length (words). Tier-1 trims to the leading clause. */
export const MAX_TITLE_WORDS = 8;

/** Clause splitters — Tier-1 keeps only the first clause for a single-task field. */
export const CLAUSE_SPLIT = /\s+(?:then|and then|after that|also|plus)\s+/i;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no usages yet; types compile).

- [ ] **Step 4: Commit**

```bash
git add src/domain/types.ts src/features/voice/parsing/parserConstants.ts
git commit -m "feat: add ParsedTaskDraft contract and voice parser constants"
```

---

## Task 2: Tier-1 pure parser (TDD)

**Files:**
- Create: `src/features/voice/parsing/spokenTaskParser.ts`
- Test: `src/features/voice/parsing/__tests__/spokenTaskParser.test.ts`

**Interfaces:**
- Consumes: `PREAMBLE_PATTERNS`, `FILLER_WORDS`, `MAX_TITLE_WORDS`, `CLAUSE_SPLIT` (Task 1); `ParsedTaskDraft` (Task 1).
- Produces: `parseSpokenTask(transcript: string): ParsedTaskDraft` — pure, `source: 'rules'`.

- [ ] **Step 1: Write the failing test**

`src/features/voice/parsing/__tests__/spokenTaskParser.test.ts`:

```ts
import { parseSpokenTask } from '../spokenTaskParser';

describe('parseSpokenTask (Tier-1 rules)', () => {
  it('strips a leading preamble and capitalizes', () => {
    const d = parseSpokenTask('i need to reply to the henderson emails');
    expect(d.title).toBe('Reply to the henderson emails');
    expect(d.source).toBe('rules');
    expect(d.rawTranscript).toBe('i need to reply to the henderson emails');
  });

  it('handles "remind me to" preamble', () => {
    expect(parseSpokenTask('remind me to call the dentist').title).toBe('Call the dentist');
  });

  it('drops filler words mid-sentence', () => {
    expect(parseSpokenTask('um just basically tidy the kitchen').title).toBe('Tidy the kitchen');
  });

  it('keeps only the first clause for a single task', () => {
    expect(parseSpokenTask('clean the desk and then email sarah').title).toBe('Clean the desk');
  });

  it('caps an over-long ramble at the word limit', () => {
    const d = parseSpokenTask('write the very long detailed report about quarterly sales numbers for the board');
    expect(d.title.split(' ').length).toBeLessThanOrEqual(8);
  });

  it('returns empty title for empty/garbage input without throwing', () => {
    expect(parseSpokenTask('   ').title).toBe('');
    expect(parseSpokenTask('um uh erm').title).toBe('');
  });

  it('leaves an already-clean imperative untouched (besides capitalization)', () => {
    expect(parseSpokenTask('book a flight').title).toBe('Book a flight');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/voice/parsing/__tests__/spokenTaskParser.test.ts`
Expected: FAIL with "Cannot find module '../spokenTaskParser'".

- [ ] **Step 3: Write the parser**

`src/features/voice/parsing/spokenTaskParser.ts`:

```ts
// Tier-1 spoken-task parser — PURE. Strips conversational preamble/filler and
// trims a ramble to a short imperative title. It does NOT paraphrase (that is the
// Tier-2 on-device LLM's job); messy input therefore stays editable. No RN, no
// clock, no network — honors the on-device-only invariant and is exhaustively
// unit-tested like the engine.

import type { ParsedTaskDraft } from '@/src/domain/types';
import {
  CLAUSE_SPLIT,
  FILLER_WORDS,
  MAX_TITLE_WORDS,
  PREAMBLE_PATTERNS,
} from './parserConstants';

const stripPreamble = (text: string): string => {
  let out = text;
  // Apply repeatedly so stacked preambles ("i need to remind me to …") collapse.
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of PREAMBLE_PATTERNS) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
};

const dropFiller = (text: string): string =>
  text
    .split(/\s+/)
    .filter((w) => w.length > 0 && !FILLER_WORDS.has(w.toLowerCase()))
    .join(' ');

const capitalizeFirst = (text: string): string =>
  text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1);

export const parseSpokenTask = (transcript: string): ParsedTaskDraft => {
  const raw = transcript.trim();
  const firstClause = raw.split(CLAUSE_SPLIT)[0] ?? '';
  const cleaned = dropFiller(stripPreamble(firstClause.trim()))
    .trim()
    .split(/\s+/)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ');

  return {
    title: capitalizeFirst(cleaned),
    rawTranscript: transcript,
    source: 'rules',
  };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/voice/parsing/__tests__/spokenTaskParser.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/features/voice/parsing/spokenTaskParser.ts src/features/voice/parsing/parserConstants.ts`
Expected: 0 problems.

- [ ] **Step 6: Commit**

```bash
git add src/features/voice/parsing
git commit -m "feat: Tier-1 pure spoken-task parser with exhaustive tests"
```

---

## Task 3: On-device STT service

**Files:**
- Create: `src/services/voice/speechRecognition.ts`

**Interfaces:**
- Consumes: `expo-speech-recognition` (`ExpoSpeechRecognitionModule`, `addSpeechRecognitionListener` or `ExpoSpeechRecognitionModule.addListener`), `src/lib/isExpoGo`.
- Produces:
  - `requestSpeechPermission(): Promise<boolean>`
  - `supportsOnDeviceSpeech(): boolean`
  - `startSpeech(handlers: SpeechHandlers): SpeechSession`
  - `type SpeechHandlers = { onPartial(text: string): void; onFinal(text: string): void; onError(code: string): void; onEnd(): void }`
  - `interface SpeechSession { stop(): void }`

> **Before writing:** confirm the exact event names/shape via Context7 (`/jamsch/expo-speech-recognition`, query "useSpeechRecognitionEvent result isFinal results transcript, ExpoSpeechRecognitionModule.start stop, requestPermissionsAsync, error event codes"). The code below matches the lib's documented surface; adjust prop names only if Context7 shows drift.

- [ ] **Step 1: Write the service**

`src/services/voice/speechRecognition.ts`:

```ts
// On-device speech-to-text wrapper. Forces local recognition so audio never
// leaves the phone (core-loop invariant). Guards Expo Go (native module absent)
// and degrades to a no-op session so callers never crash.

import { isExpoGo } from '@/src/lib/isExpoGo';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

export interface SpeechHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
  onEnd: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

const NOOP_SESSION: SpeechSession = { stop: () => {} };

export const supportsOnDeviceSpeech = (): boolean => {
  if (isExpoGo) return false;
  try {
    return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
};

export const requestSpeechPermission = async (): Promise<boolean> => {
  if (isExpoGo) return false;
  const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return result.granted;
};

export const startSpeech = (handlers: SpeechHandlers): SpeechSession => {
  if (isExpoGo) {
    handlers.onError('expo-go-unsupported');
    return NOOP_SESSION;
  }

  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
      const transcript = e.results?.[0]?.transcript ?? '';
      if (e.isFinal) handlers.onFinal(transcript);
      else handlers.onPartial(transcript);
    }),
    ExpoSpeechRecognitionModule.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
      handlers.onError(e.error ?? 'unknown');
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      handlers.onEnd();
    }),
  ];

  ExpoSpeechRecognitionModule.start({
    lang: 'en-US',
    interimResults: true,
    requiresOnDeviceRecognition: true,
    addsPunctuation: true,
    continuous: false,
  });

  return {
    stop: () => {
      ExpoSpeechRecognitionModule.stop();
      subs.forEach((s) => s.remove());
    },
  };
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If the lib's exported event-type names differ, fix the imports to the names Context7 reports (do not `any`-cast).

- [ ] **Step 3: Lint**

Run: `npx eslint src/services/voice/speechRecognition.ts`
Expected: 0 problems.

- [ ] **Step 4: Commit**

```bash
git add src/services/voice/speechRecognition.ts
git commit -m "feat: on-device speech-recognition service with Expo Go guard"
```

---

## Task 4: `useVoiceCapture` hook (Tier-1 wired)

**Files:**
- Create: `src/features/voice/useVoiceCapture.ts`
- Test: `src/features/voice/__tests__/useVoiceCapture.test.ts`

**Interfaces:**
- Consumes: `startSpeech`, `requestSpeechPermission`, `supportsOnDeviceSpeech` (Task 3); `parseSpokenTask` (Task 2); `ParsedTaskDraft` (Task 1). (Tier-2 structurer is swapped in at Task 12 — for now structuring is Tier-1 only.)
- Produces:
  - `type VoiceStatus = 'idle' | 'listening' | 'unavailable' | 'denied'`
  - `useVoiceCapture(onDraft: (d: ParsedTaskDraft) => void): { status: VoiceStatus; partial: string; start(): Promise<void>; stop(): void }`

- [ ] **Step 1: Write the failing test**

`src/features/voice/__tests__/useVoiceCapture.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-native';
import { useVoiceCapture } from '../useVoiceCapture';
import * as stt from '@/src/services/voice/speechRecognition';

jest.mock('@/src/services/voice/speechRecognition');
const mockStt = stt as jest.Mocked<typeof stt>;

describe('useVoiceCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStt.supportsOnDeviceSpeech.mockReturnValue(true);
  });

  it('starts listening when permission is granted', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(true);
    mockStt.startSpeech.mockReturnValue({ stop: jest.fn() });
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('listening');
    expect(mockStt.startSpeech).toHaveBeenCalled();
  });

  it('sets denied status when permission is refused', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('denied');
    expect(mockStt.startSpeech).not.toHaveBeenCalled();
  });

  it('emits a parsed draft on final transcript and returns to idle', async () => {
    mockStt.requestSpeechPermission.mockResolvedValue(true);
    let handlers: stt.SpeechHandlers | undefined;
    mockStt.startSpeech.mockImplementation((h) => { handlers = h; return { stop: jest.fn() }; });
    const onDraft = jest.fn();
    const { result } = renderHook(() => useVoiceCapture(onDraft));

    await act(async () => { await result.current.start(); });
    await act(async () => { handlers!.onFinal('i need to email sarah'); });

    expect(onDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Email sarah', source: 'rules' }),
    );
    expect(result.current.status).toBe('idle');
  });

  it('reports unavailable when the device lacks on-device speech', async () => {
    mockStt.supportsOnDeviceSpeech.mockReturnValue(false);
    const { result } = renderHook(() => useVoiceCapture(jest.fn()));

    await act(async () => { await result.current.start(); });

    expect(result.current.status).toBe('unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/voice/__tests__/useVoiceCapture.test.ts`
Expected: FAIL with "Cannot find module '../useVoiceCapture'".

- [ ] **Step 3: Write the hook**

`src/features/voice/useVoiceCapture.ts`:

```ts
// Orchestrates one voice capture: permission → on-device STT → live partials →
// structure the final transcript into a draft. The single place tiering lives;
// Tier-2 (Apple LLM) is layered in at Task 12 via structureSpokenTask(). Until
// then it structures with the pure Tier-1 parser.

import { useCallback, useRef, useState } from 'react';
import type { ParsedTaskDraft } from '@/src/domain/types';
import { parseSpokenTask } from './parsing/spokenTaskParser';
import {
  requestSpeechPermission,
  startSpeech,
  supportsOnDeviceSpeech,
  type SpeechSession,
} from '@/src/services/voice/speechRecognition';

export type VoiceStatus = 'idle' | 'listening' | 'unavailable' | 'denied';

export interface VoiceCapture {
  status: VoiceStatus;
  partial: string;
  start: () => Promise<void>;
  stop: () => void;
}

export const useVoiceCapture = (onDraft: (d: ParsedTaskDraft) => void): VoiceCapture => {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [partial, setPartial] = useState('');
  const sessionRef = useRef<SpeechSession | null>(null);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setPartial('');
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!supportsOnDeviceSpeech()) {
      setStatus('unavailable');
      return;
    }
    const granted = await requestSpeechPermission();
    if (!granted) {
      setStatus('denied');
      return;
    }
    setPartial('');
    setStatus('listening');
    sessionRef.current = startSpeech({
      onPartial: setPartial,
      onFinal: (text) => {
        sessionRef.current?.stop();
        sessionRef.current = null;
        setPartial('');
        setStatus('idle');
        const draft = parseSpokenTask(text);
        if (draft.title.length > 0) onDraft(draft);
      },
      onError: () => stop(),
      onEnd: () => {
        if (sessionRef.current) stop();
      },
    });
  }, [onDraft, stop]);

  return { status, partial, start, stop };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/voice/__tests__/useVoiceCapture.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/features/voice/useVoiceCapture.ts`
Expected: 0 problems.

- [ ] **Step 6: Commit**

```bash
git add src/features/voice
git commit -m "feat: useVoiceCapture hook orchestrating on-device STT + Tier-1 parse"
```

---

## Task 5: Theme tokens for voice surfaces

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/theme/useTheme.ts` (only if a new top-level group is added)

**Interfaces:**
- Produces: `t.iconSize.md` (20) if absent; any voice-pulse motion value reused from existing `t.motion`.

- [ ] **Step 1: Check what already exists**

Run: `grep -nE "iconSize|sheet|pulse" src/theme/tokens.ts`
Expected: shows whether `iconSize` exists. The audit found `t.radii.sheet` (20) and `t.size.control` already exist; `t.motion.spring` exists.

- [ ] **Step 2: Add only the missing tokens**

If `iconSize` is absent, add a group to `tokens.ts` (mirror the existing structure) and a matching line in `useTheme.ts`'s `resolveTheme` (else `t.iconSize` is undefined):

```ts
// tokens.ts — add near size tokens
export const iconSize = { sm: 16, md: 20, lg: 24 } as const;
```

```ts
// useTheme.ts resolveTheme — add to the returned object
iconSize,
```

Reuse `t.motion.spring` for the press dip and a looped opacity/scale for the pulse — **do not** add bespoke duration numbers; if a loop duration is needed, add `motion.pulse = 1400` to the existing `motion` group.

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/theme/tokens.ts src/theme/useTheme.ts`
Expected: PASS, 0 problems.

- [ ] **Step 4: Commit**

```bash
git add src/theme/tokens.ts src/theme/useTheme.ts
git commit -m "feat: add iconSize (and pulse) tokens for voice mic surfaces"
```

---

## Task 6: `MicButton` component

**Files:**
- Create: `src/components/voice/MicButton.tsx`

**Interfaces:**
- Consumes: `expo-symbols` `SymbolView`; `useTheme`; Reanimated; `VoiceStatus` (Task 4).
- Produces: `MicButton({ status, onPress }: { status: VoiceStatus; onPress: () => void })` — bare Pressable + animated inner View, SF Symbol glyph.

- [ ] **Step 1: Write the component**

`src/components/voice/MicButton.tsx`:

```tsx
// Trailing mic affordance for a task-title field. Bare Pressable wrapper (the
// reactCompiler + nativewind gotcha drops function-form styles), all visuals on
// an inner Animated.View. SF Symbol glyph for a native iOS feel. Idle = mic,
// listening = mic.fill in primary. Voice is always optional — never required.

import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/src/theme/useTheme';
import type { VoiceStatus } from '@/src/features/voice/useVoiceCapture';

interface MicButtonProps {
  status: VoiceStatus;
  onPress: () => void;
}

export const MicButton = ({ status, onPress }: MicButtonProps) => {
  const t = useTheme();
  const scale = useSharedValue(1);
  const active = status === 'listening';

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => scale.set(withSpring(0.92, t.motion.spring))}
      onPressOut={() => scale.set(withSpring(1, t.motion.spring))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Speak your task"
    >
      <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, animStyle]}>
        <View>
          <SymbolView
            name={active ? 'mic.fill' : 'mic'}
            size={t.iconSize.md}
            tintColor={active ? t.colors.primary : t.colors.inkSoft}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
};
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/voice/MicButton.tsx`
Expected: PASS, 0 problems.

- [ ] **Step 3: Commit**

```bash
git add src/components/voice/MicButton.tsx
git commit -m "feat: MicButton SF-symbol affordance for task-title fields"
```

---

## Task 7: `ListeningSheet` component

**Files:**
- Create: `src/components/voice/ListeningSheet.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useSafeAreaInsets`, Reanimated, `AppButton`.
- Produces: `ListeningSheet({ visible, partial, onStop }: { visible: boolean; partial: string; onStop: () => void })`.

- [ ] **Step 1: Write the component**

`src/components/voice/ListeningSheet.tsx`:

```tsx
// Bottom sheet shown while listening: live partial transcript, a looping mic
// pulse, and a Stop button. Entering-only animations (no exiting on a
// conditionally-unmounted view → Fabric SIGABRT). Transform/opacity only.
// Bottom inset added so the Stop button clears the home indicator.

import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { SymbolView } from 'expo-symbols';
import { AppButton } from '@/src/components/AppButton';
import { useTheme } from '@/src/theme/useTheme';

interface ListeningSheetProps {
  visible: boolean;
  partial: string;
  onStop: () => void;
}

export const ListeningSheet = ({ visible, partial, onStop }: ListeningSheetProps) => {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    pulse.set(0);
    pulse.set(withRepeat(withTiming(1, { duration: t.motion.pulse, easing: Easing.out(Easing.ease) }), -1, false));
  }, [visible, pulse, t.motion.pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 0.6 }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onStop}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.scrim }}>
        <Animated.View
          entering={FadeIn.duration(t.motion.base)}
          style={{
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radii.sheet,
            borderTopRightRadius: t.radii.sheet,
            borderTopWidth: t.borderWidth.hairline,
            borderColor: t.colors.hairline,
            paddingHorizontal: t.space[5],
            paddingTop: t.space[6],
            paddingBottom: t.space[5] + insets.bottom,
            gap: t.space[5],
            alignItems: 'center',
          }}
        >
          <View style={{ width: t.size.control.lg, height: t.size.control.lg, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={[
                { position: 'absolute', width: t.size.control.lg, height: t.size.control.lg, borderRadius: t.radii.full, backgroundColor: t.colors.primarySoft },
                ringStyle,
              ]}
            />
            <SymbolView name="mic.fill" size={t.iconSize.lg} tintColor={t.colors.primary} />
          </View>

          <Text style={{ fontSize: t.fontSize.md, color: t.colors.inkSoft, textAlign: 'center', minHeight: t.space[10] }}>
            {partial.length > 0 ? partial : 'Listening…'}
          </Text>

          <AppButton label="Stop" variant="ghost" size="md" fullWidth onPress={onStop} />
        </Animated.View>
      </View>
    </Modal>
  );
};
```

> If `t.colors.scrim` or `t.borderWidth.hairline` are not present, add them in Task 5's pass (scrim ≈ a translucent ink overlay) rather than inlining a hex/number.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/components/voice/ListeningSheet.tsx`
Expected: PASS, 0 problems.

- [ ] **Step 3: Commit**

```bash
git add src/components/voice/ListeningSheet.tsx
git commit -m "feat: ListeningSheet with live partials and entering-only pulse"
```

---

## Task 8: `TaskTitleField` shared component + refactor 3 screens

**Files:**
- Create: `src/components/TaskTitleField.tsx`
- Modify: `src/app/(modals)/add-task.tsx:131-142`
- Modify: `src/features/planner/BuildView.tsx:214-225`
- Modify: `src/app/(modals)/retro.tsx:62-69`

**Interfaces:**
- Consumes: `useVoiceCapture` (Task 4), `MicButton` (Task 6), `ListeningSheet` (Task 7), `useTheme`.
- Produces: `TaskTitleField(props)` where

```ts
interface TaskTitleFieldProps {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  variant?: 'boxed' | 'underline';
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'default';
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}
```

Voice fills the field by calling `onChangeText(draft.title)` — the screen's existing `onChangeText` (`setTitle`/composer `handleTitleChange`/`setLabel`) then runs `guessCategory` + honest suggestion unchanged. **No screen needs new category/estimate wiring.**

- [ ] **Step 1: Write the component**

`src/components/TaskTitleField.tsx`:

```tsx
// Shared task-title input with an attached on-device voice affordance. Controlled
// like a plain TextInput (value/onChangeText), so each screen keeps its own store
// wiring; voice simply produces a cleaned title and pushes it through onChangeText,
// reusing the app's category-guess + honest-estimate cascade. Two visual variants
// match the existing screens (boxed: add-task/retro; underline: planner composer).

import { useState } from 'react';
import { TextInput, View, type TextStyle, type ViewStyle } from 'react-native';
import { MicButton } from '@/src/components/voice/MicButton';
import { ListeningSheet } from '@/src/components/voice/ListeningSheet';
import { useVoiceCapture } from '@/src/features/voice/useVoiceCapture';
import { useTheme } from '@/src/theme/useTheme';
import type { ParsedTaskDraft } from '@/src/domain/types';

interface TaskTitleFieldProps {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  variant?: 'boxed' | 'underline';
  autoFocus?: boolean;
  returnKeyType?: 'done' | 'default';
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
}

export const TaskTitleField = ({
  value,
  onChangeText,
  placeholder,
  variant = 'boxed',
  autoFocus,
  returnKeyType = 'default',
  onSubmitEditing,
  accessibilityLabel,
}: TaskTitleFieldProps) => {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  const voice = useVoiceCapture((draft: ParsedTaskDraft) => onChangeText(draft.title));

  const text: TextStyle = {
    flex: 1,
    fontFamily: 'Jakarta-Regular',
    fontSize: t.fontSize.base,
    color: t.colors.ink,
  };

  const boxed: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderWidth: t.borderWidth.thin,
    borderColor: focused ? t.colors.primary : t.colors.hairline,
    borderRadius: t.radii.md,
    paddingHorizontal: t.space[4],
    minHeight: t.size.control.md,
  };

  const underline: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    borderBottomWidth: t.borderWidth.thin,
    borderColor: focused ? t.colors.primary : t.colors.hairline,
    paddingVertical: t.space[2],
  };

  return (
    <>
      <View style={variant === 'boxed' ? boxed : underline}>
        <TextInput
          style={text}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.colors.inkFaint}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect
          autoCapitalize="sentences"
          accessibilityLabel={accessibilityLabel}
        />
        <MicButton status={voice.status} onPress={voice.start} />
      </View>
      <ListeningSheet visible={voice.status === 'listening'} partial={voice.partial} onStop={voice.stop} />
    </>
  );
};
```

- [ ] **Step 2: Refactor `add-task.tsx`**

Replace the title `TextInput` block (lines ~131-142) with:

```tsx
<TaskTitleField
  variant="boxed"
  value={a.title}
  onChangeText={a.setTitle}
  placeholder="e.g. Reply to that email"
  accessibilityLabel="Task name"
/>
```

Add the import: `import { TaskTitleField } from '@/src/components/TaskTitleField';`. Remove the now-dead local input styles + focus state if unused elsewhere in the file.

- [ ] **Step 3: Refactor `BuildView.tsx` InlineComposer**

Replace the composer `TextInput` (lines ~214-225) with:

```tsx
<TaskTitleField
  variant="underline"
  value={state.title}
  onChangeText={handleTitleChange}
  placeholder="Task name"
  autoFocus
  returnKeyType="done"
  onSubmitEditing={handleConfirm}
/>
```

Keep `titleRef`-based focus only if still needed; `autoFocus` covers the open-to-focus case. Add the import.

- [ ] **Step 4: Refactor `retro.tsx`**

Replace the description `TextInput` (lines ~62-69) with:

```tsx
<TaskTitleField
  variant="boxed"
  value={r.label}
  onChangeText={r.setLabel}
  placeholder="e.g. Tidied the kitchen"
  accessibilityLabel="What was it"
/>
```

Add the import.

- [ ] **Step 5: Typecheck + lint the touched files**

Run: `npm run typecheck && npx eslint src/components/TaskTitleField.tsx "src/app/(modals)/add-task.tsx" "src/app/(modals)/retro.tsx" src/features/planner/BuildView.tsx`
Expected: PASS, 0 problems.

- [ ] **Step 6: Build & screenshot-verify on the sim**

Run: `npm run ios`
Then exercise add-task, planner composer, and retro. Capture each with `xcrun simctl io booted screenshot`. **Invoke `ui-design:react-native-design` + `ui-design:mobile-ios-design` and look critically:** mic vertically centered to text cap-height, 44pt tap target, no column drift, placeholder/ink colors correct in light + dark. Tap mic → sheet appears, partials stream, Stop dismisses, transcript lands as the title and the category chip + honest estimate populate. Fix before proceeding. UI ships only on founder approval of these screenshots.

- [ ] **Step 7: Commit**

```bash
git add src/components/TaskTitleField.tsx "src/app/(modals)/add-task.tsx" "src/app/(modals)/retro.tsx" src/features/planner/BuildView.tsx
git commit -m "feat: shared TaskTitleField with mic; wire voice into add-task, planner, retro"
```

> **End of Phase 2 — shippable FREE voice flow (Tier-1 structuring).**

---

## Task 9: `OnDeviceLlm` interface (vendor-neutral seam)

**Files:**
- Create: `src/services/ai/onDeviceLlm.ts`

**Interfaces:**
- Produces:
  - `type AiAvailability = 'available' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'unavailable'`
  - `interface LlmStructuredField { type: 'string'; description: string }`
  - `interface OnDeviceLlm { availability(): Promise<AiAvailability>; structure<T extends Record<string, string>>(args: { instructions: string; prompt: string; schema: Record<keyof T, LlmStructuredField> }): Promise<T | null> }`

> This is the swap point. Every future AI feature depends on `OnDeviceLlm`, never on a vendor package. Replacing deveix with `@react-native-ai/apple` later means rewriting only `appleLlmProvider.ts` (Task 10).

- [ ] **Step 1: Write the interface**

`src/services/ai/onDeviceLlm.ts`:

```ts
// Vendor-neutral contract for the on-device LLM. Keeps feature code independent
// of which Apple Foundation Models bridge we ship, so the vendor can be swapped in
// a single adapter file. On-device only — there is intentionally no network path.

export type AiAvailability =
  | 'available'
  | 'appleIntelligenceNotEnabled'
  | 'modelNotReady'
  | 'unavailable';

/** A single structured-output field. v1 only needs string fields. */
export interface LlmStructuredField {
  type: 'string';
  description: string;
}

export interface OnDeviceLlm {
  /** Current Apple Intelligence availability on this device. */
  availability: () => Promise<AiAvailability>;
  /**
   * Run one structured-output generation. Returns the validated object, or null
   * if the model is unavailable / errors — callers fall back to Tier-1.
   */
  structure: <T extends Record<string, string>>(args: {
    instructions: string;
    prompt: string;
    schema: { [K in keyof T]: LlmStructuredField };
  }) => Promise<T | null>;
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/services/ai/onDeviceLlm.ts`
Expected: PASS, 0 problems.

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/onDeviceLlm.ts
git commit -m "feat: vendor-neutral OnDeviceLlm interface for on-device AI"
```

---

## Task 10: Apple LLM provider adapter

**Files:**
- Create: `src/services/ai/appleLlmProvider.ts`
- Create: `src/services/ai/index.ts`

**Interfaces:**
- Consumes: `react-native-apple-llm` (`isFoundationModelsEnabled`, `AppleLLMSession`), `OnDeviceLlm`/`AiAvailability`/`LlmStructuredField` (Task 9), `isExpoGo`.
- Produces: `getOnDeviceLlm(): OnDeviceLlm` (singleton).

> **Before writing:** verify the deveix API surface (`isFoundationModelsEnabled()` return strings; `AppleLLMSession.configure`/`generateStructuredOutput` option + schema shape; `dispose()`) from the README (https://github.com/deveix/react-native-apple-llm). The audit confirmed: `isFoundationModelsEnabled()` → `'available' | 'appleIntelligenceNotEnabled' | 'modelNotReady' | 'unavailable'`; `generateStructuredOutput({ structure, prompt })` with JSON-schema-ish fields (`type`, `description`, `enum`). Adjust the mapping below to the exact prop names the README shows.

- [ ] **Step 1: Write the adapter**

`src/services/ai/appleLlmProvider.ts`:

```ts
// Adapter: react-native-apple-llm (Apple Foundation Models, on-device) → our
// OnDeviceLlm contract. THE ONLY FILE that imports the vendor package. Guards
// Expo Go and any device without Apple Intelligence, returning 'unavailable' /
// null so callers fall back to Tier-1 rules.

import { isExpoGo } from '@/src/lib/isExpoGo';
import {
  AppleLLMSession,
  isFoundationModelsEnabled,
} from 'react-native-apple-llm';
import type { AiAvailability, LlmStructuredField, OnDeviceLlm } from './onDeviceLlm';

const availability = async (): Promise<AiAvailability> => {
  if (isExpoGo) return 'unavailable';
  try {
    return (await isFoundationModelsEnabled()) as AiAvailability;
  } catch {
    return 'unavailable';
  }
};

const structure: OnDeviceLlm['structure'] = async ({ instructions, prompt, schema }) => {
  if ((await availability()) !== 'available') return null;
  const session = new AppleLLMSession();
  try {
    await session.configure({ instructions });
    // deveix expects a "structure" map of field → { type, description }.
    const result = await session.generateStructuredOutput({
      structure: schema as Record<string, LlmStructuredField>,
      prompt,
    });
    return (result ?? null) as Awaited<ReturnType<OnDeviceLlm['structure']>>;
  } catch {
    return null;
  } finally {
    session.dispose();
  }
};

export const appleLlmProvider: OnDeviceLlm = { availability, structure };
```

`src/services/ai/index.ts`:

```ts
import type { OnDeviceLlm } from './onDeviceLlm';
import { appleLlmProvider } from './appleLlmProvider';

// Single accessor so feature code never names a concrete provider. Swap the
// import here (and the adapter file) to change vendors.
export const getOnDeviceLlm = (): OnDeviceLlm => appleLlmProvider;
export type { OnDeviceLlm, AiAvailability } from './onDeviceLlm';
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/services/ai/appleLlmProvider.ts src/services/ai/index.ts`
Expected: PASS, 0 problems. Fix any prop-name mismatch against the README (no `any` beyond the single documented-shape cast).

- [ ] **Step 3: Commit**

```bash
git add src/services/ai/appleLlmProvider.ts src/services/ai/index.ts
git commit -m "feat: Apple Foundation Models adapter behind OnDeviceLlm"
```

---

## Task 11: Tier-2 structurer with Tier-1 fallback (TDD)

**Files:**
- Create: `src/services/voice/spokenTaskStructurer.ts`
- Test: `src/services/voice/__tests__/spokenTaskStructurer.test.ts`

**Interfaces:**
- Consumes: `getOnDeviceLlm` (Task 10), `parseSpokenTask` (Task 2), `ParsedTaskDraft` (Task 1).
- Produces: `structureSpokenTask(transcript: string): Promise<ParsedTaskDraft>` — tries Tier-2 LLM, falls back to Tier-1 on null/short output, `source` set accordingly.

- [ ] **Step 1: Write the failing test**

`src/services/voice/__tests__/spokenTaskStructurer.test.ts`:

```ts
import { structureSpokenTask } from '../spokenTaskStructurer';
import { getOnDeviceLlm } from '@/src/services/ai';

jest.mock('@/src/services/ai');
const mockGet = getOnDeviceLlm as jest.MockedFunction<typeof getOnDeviceLlm>;

const llm = (structureImpl: jest.Mock) => {
  mockGet.mockReturnValue({ availability: jest.fn(), structure: structureImpl });
};

describe('structureSpokenTask', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the LLM title when the model returns one (source appleLLM)', async () => {
    llm(jest.fn().mockResolvedValue({ title: 'Write email to Frederick' }));
    const d = await structureSpokenTask('write that email i was thinking about for frederick');
    expect(d).toEqual({
      title: 'Write email to Frederick',
      rawTranscript: 'write that email i was thinking about for frederick',
      source: 'appleLLM',
    });
  });

  it('falls back to Tier-1 rules when the model returns null', async () => {
    llm(jest.fn().mockResolvedValue(null));
    const d = await structureSpokenTask('i need to reply to the henderson emails');
    expect(d.title).toBe('Reply to the henderson emails');
    expect(d.source).toBe('rules');
  });

  it('falls back to Tier-1 when the model returns an empty title', async () => {
    llm(jest.fn().mockResolvedValue({ title: '   ' }));
    const d = await structureSpokenTask('remind me to call the dentist');
    expect(d.title).toBe('Call the dentist');
    expect(d.source).toBe('rules');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/voice/__tests__/spokenTaskStructurer.test.ts`
Expected: FAIL with "Cannot find module '../spokenTaskStructurer'".

- [ ] **Step 3: Write the structurer**

`src/services/voice/spokenTaskStructurer.ts`:

```ts
// Tier-2 structuring: ask the on-device Apple model to rewrite a spoken ramble
// into a short imperative task. On any non-availability, error, or empty result,
// fall back to the pure Tier-1 parser. Category + honest estimate are NOT asked
// for here — the field's onChangeText cascade derives them from the title.

import type { ParsedTaskDraft } from '@/src/domain/types';
import { getOnDeviceLlm } from '@/src/services/ai';
import { parseSpokenTask } from '@/src/features/voice/parsing/spokenTaskParser';

const INSTRUCTIONS =
  'Rewrite the user’s spoken note into a single short task. Start with a verb, ' +
  'imperative mood, at most 6 words, no preamble or filler. Return only the task title.';

export const structureSpokenTask = async (transcript: string): Promise<ParsedTaskDraft> => {
  const llmResult = await getOnDeviceLlm().structure<{ title: string }>({
    instructions: INSTRUCTIONS,
    prompt: transcript,
    schema: { title: { type: 'string', description: 'The rewritten imperative task title' } },
  });

  const llmTitle = llmResult?.title?.trim() ?? '';
  if (llmTitle.length > 0) {
    return { title: llmTitle, rawTranscript: transcript, source: 'appleLLM' };
  }
  return parseSpokenTask(transcript); // Tier-1 fallback (source: 'rules')
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/services/voice/__tests__/spokenTaskStructurer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/services/voice/spokenTaskStructurer.ts`
Expected: 0 problems.

- [ ] **Step 6: Commit**

```bash
git add src/services/voice/spokenTaskStructurer.ts src/services/voice/__tests__/spokenTaskStructurer.test.ts
git commit -m "feat: Tier-2 on-device LLM structurer with Tier-1 fallback"
```

---

## Task 12: Swap the hook to Tier-2 structuring

**Files:**
- Modify: `src/features/voice/useVoiceCapture.ts`
- Modify: `src/features/voice/__tests__/useVoiceCapture.test.ts`

**Interfaces:**
- Consumes: `structureSpokenTask` (Task 11) replacing the direct `parseSpokenTask` call in `onFinal`.
- Produces: unchanged public `VoiceCapture` shape; `onDraft` now fires with the best available tier.

- [ ] **Step 1: Update the test for async structuring**

In `useVoiceCapture.test.ts`, mock the structurer and assert the draft still flows. Replace the "emits a parsed draft" test with:

```ts
import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';
jest.mock('@/src/services/voice/spokenTaskStructurer');
const mockStructure = structureSpokenTask as jest.MockedFunction<typeof structureSpokenTask>;

it('emits a structured draft on final transcript and returns to idle', async () => {
  mockStt.requestSpeechPermission.mockResolvedValue(true);
  mockStructure.mockResolvedValue({ title: 'Email Sarah', rawTranscript: 'x', source: 'appleLLM' });
  let handlers: stt.SpeechHandlers | undefined;
  mockStt.startSpeech.mockImplementation((h) => { handlers = h; return { stop: jest.fn() }; });
  const onDraft = jest.fn();
  const { result } = renderHook(() => useVoiceCapture(onDraft));

  await act(async () => { await result.current.start(); });
  await act(async () => { await handlers!.onFinal('i need to email sarah'); });

  expect(mockStructure).toHaveBeenCalledWith('i need to email sarah');
  expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ title: 'Email Sarah' }));
  expect(result.current.status).toBe('idle');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/voice/__tests__/useVoiceCapture.test.ts`
Expected: FAIL (hook still calls `parseSpokenTask`, structurer mock not invoked).

- [ ] **Step 3: Update the hook's `onFinal`**

In `useVoiceCapture.ts`: remove the `parseSpokenTask` import, add `import { structureSpokenTask } from '@/src/services/voice/spokenTaskStructurer';`, and change `onFinal` to await the structurer:

```ts
onFinal: (text) => {
  sessionRef.current?.stop();
  sessionRef.current = null;
  setPartial('');
  setStatus('idle');
  void structureSpokenTask(text).then((draft) => {
    if (draft.title.length > 0) onDraft(draft);
  });
},
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/voice/__tests__/useVoiceCapture.test.ts`
Expected: PASS (all tests). The "denied"/"unavailable" cases are unchanged.

- [ ] **Step 5: Lint + full suite**

Run: `npx eslint src/features/voice/useVoiceCapture.ts && npm test`
Expected: 0 problems; full suite green.

- [ ] **Step 6: Device verification (iOS 26 + Apple Intelligence)**

Run on a real iOS 26 device with Apple Intelligence ON: speak a messy ramble ("write that email I keep meaning to send to Frederick") → expect a clean Tier-2 rewrite ("Write email to Frederick"). Toggle Apple Intelligence OFF (or test on a non-AI device/sim) → expect graceful Tier-1 output ("Write email to Frederick" via rules may differ; must not crash). Confirm category chip + honest estimate populate in all three screens.

- [ ] **Step 7: Commit**

```bash
git add src/features/voice/useVoiceCapture.ts src/features/voice/__tests__/useVoiceCapture.test.ts
git commit -m "feat: route voice capture through Tier-2 LLM structurer with fallback"
```

> **End of Phase 3 — FREE flow with Apple on-device LLM quality boost.**

---

## Task 13 (OPTIONAL, Phase 4): Tier-1 NER enrichment — defer unless needed

**Status:** Build only if Tier-1 (non-AI device) output is judged too weak in device testing. Person/datetime extraction via a custom `NaturalLanguage` (NLTagger) Expo module is a Swift module + config plugin — a meaningfully larger unit of work than the rest of this plan. It does **not** block the shippable free flow (Phases 1–3 already ship).

**If built, scope it as its own mini-plan:**
- Create an Expo Module (`expo-module create` or a local module under `modules/`) wrapping `NLTagger` for `nameType`/`lexicalClass`.
- Config plugin to register it; `isExpoGo`-guarded JS bridge `src/services/ai/nameTagger.ts` exposing `extractPersonNames(text): string[]`.
- Enhance `parseSpokenTask` to keep a detected person name in the title (TDD: "email sarah about the thing" keeps "Sarah").
- Same lint/typecheck/test/commit discipline as above.

Do not implement inline here — write a dedicated plan when the device test in Task 12 Step 6 shows Tier-1 needs it.

---

## Verification (run before opening the PR)

- [ ] `npm run lint` → 0 warnings.
- [ ] `npm run typecheck` → clean.
- [ ] `npm test` → green (parser, structurer, hook suites).
- [ ] `npx expo-doctor` → 0 issues.
- [ ] Sim + device screenshots of add-task, planner composer, retro (idle field, listening sheet, post-transcript with category + honest estimate) — founder-approved.
- [ ] Confirm no network in the flow: STT `requiresOnDeviceRecognition: true`, LLM is Apple on-device, no fetch/axios added.
- [ ] Open PR (Conventional Commits, no AI trailers). **Do not merge** — founder reviews and merges.

---

## Self-Review (checked against docs 08/09)

**Spec coverage**
- FREE speak → task + category + honest estimate, editable, saved → Tasks 2,4,8 (title) + reuse of `guessCategory`/honest-suggestion cascade (no new code) ✓
- On-device STT, forced local → Task 3 ✓
- Tier-2 Apple Foundation Models with graceful gating + fallback → Tasks 9–12 ✓
- Tier-1 rules baseline, always editable → Tasks 1,2,8 ✓
- Mic on every task-name input (3 fields) via shared component → Task 8 ✓
- Scalable for future AI features → `OnDeviceLlm` seam (Tasks 9,10) reused by any future feature ✓
- Pro accelerant (multi-task split, hands-free, voice retro) → explicitly out of scope (founder chose free-flow-only) ✓
- Tier-1 NER → Task 13 deferred/optional, correctly not blocking ✓

**Placeholder scan:** no TBD/"add error handling"/"write tests for the above" — every code + test step is concrete. Native-lib prop names flagged for Context7/README verification at the two wrapper tasks, with the documented shape supplied.

**Type consistency:** `ParsedTaskDraft { title; rawTranscript; source }` used identically in parser (Task 2), structurer (Task 11), hook (Tasks 4/12), and field (Task 8). `VoiceStatus` consistent across hook (4), MicButton (6), TaskTitleField (8). `OnDeviceLlm.structure` signature consistent between interface (9), adapter (10), and structurer (11).

**Open verification points (call out during execution):** (a) exact `expo-speech-recognition` event names — Context7 before Task 3; (b) exact deveix `configure`/`generateStructuredOutput` prop names — README before Task 10; (c) `expo-symbols` `SymbolView` prop names (`tintColor` vs `tint`) — Context7 before Task 6; (d) presence of `t.colors.scrim` / `t.borderWidth.hairline` / `iconSize` tokens — Task 5.
