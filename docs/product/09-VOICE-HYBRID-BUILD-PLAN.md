# Hybrid Voice Flow — Build Plan

**Date:** 2026-06-19
**Status:** Implementation plan. Pairs with [`08-VOICE-INTAKE-EVALUATION.md`](./08-VOICE-INTAKE-EVALUATION.md).
**Decision recap (locked):** Hybrid. **FREE** = speak → task + category + your honest estimate, editable, saved. **PRO** (folds into Model B) = the accelerant: hands-free Siri/widget capture, multi-task ramble split, voice retro. Everything on-device — **no cloud STT, no cloud LLM** (core-loop invariant).

---

## 0. The structuring question, answered

"Ramble → short imperative task" (*"write that email I was thinking about for Frederick"* → *"Write email to Frederick"*) is achievable **with zero cloud/Claude**, via a tiered on-device pipeline:

- **STT (all devices):** `expo-speech-recognition`, forced `requiresOnDeviceRecognition: true`. Free, audio stays local.
- **Tier 2 rewrite (iOS 26 + Apple Intelligence devices):** **Apple Foundation Models** — Apple's *on-device* ~3B LLM. Free, offline, network-free. RN bridge: `react-native-apple-llm` (or `@react-native-ai/apple`). This is the true rewrite path (Apple's own "Stuff: Listen Mode" demo = speak thoughts → organized tasks, on-device).
- **Tier 1 fallback (older iOS / AI off):** rules (preamble + filler strip) + **Apple NaturalLanguage** POS/NER (person-name extraction). ~70% on clean sentences; cannot truly paraphrase messy input → result must stay editable.

> Honest limit: regex/NER does *labeling, not rewriting*. The on-device Apple LLM is what closes the gap while staying network-free. Older devices get the rules baseline + an always-editable draft.

---

## 1. Scope

**In (this plan):**
- FREE: in-app mic → on-device STT → structure (Tier 2 LLM if available, else Tier 1 rules) → draft task with category + honest estimate → edit & save into existing composer/planner.
- PRO gate scaffolding (RevenueCat entitlement check) for the accelerant features.
- PRO: multi-task ramble split (one utterance → N drafts).

**Out (phased later, separate work):**
- PRO hands-free capture (Siri App Intents + widget/Lock-Screen) — depends on the scaffolded-but-unbuilt `WhenbeePresence` native module (`docs/NATIVE-PRESENCE.md`). Fast-follow.
- PRO voice retro (speak "how'd it go" at task end).
- Tier-1 NaturalLanguage NER native module — enhancement; Tier 1 ships rules-only first.
- TTS speak-back of insights (`expo-speech`) — future.

---

## 2. Architecture (respects the layer + ESLint boundaries)

Data flow follows the repo's one-directional rule. UI never imports services/db directly — it routes through the feature hook.

```
UI (src/features/voice/components/*, mic button in composer)
  → feature hook (src/features/voice/useVoiceCapture.ts)        ← orchestration + tiering + Pro gate
      → services (src/services/voice/*)                          ← native, IO, isExpoGo-guarded
          · speechRecognition.ts   (expo-speech-recognition)
          · appleIntelligence.ts   (react-native-apple-llm, Tier 2)
          · naturalLanguage.ts     (custom NLTagger module, Tier 1 — phased)
      → pure parser (src/features/voice/parsing/*)               ← PURE TS, TDD, no RN
          · spokenTaskParser.ts    (preamble/filler strip, assemble)
          · parserConstants.ts     (phrase lists — no magic strings)
      → engine (src/engine)                                      ← honest estimate from category (existing, pure)
      → domain types (src/domain/types.ts)                       ← ParsedTaskDraft contract
```

**Why this split (software-architecture + clean-code):**
- Pure parser is framework-free and exhaustively unit-tested (TDD), like the engine.
- All native/IO sits behind services with `isExpoGo` guards that degrade gracefully.
- The hook is the only place tiering + fallback + Pro gating live — one responsibility each, files < 200 lines.
- Domain-specific names (`spokenTaskParser`, `appleIntelligence`), never `utils`/`helpers`.

---

## 3. Domain contract (change types first)

`src/domain/types.ts`:

```ts
export type VoiceStructuringSource = 'appleLLM' | 'rules';

export interface ParsedTaskDraft {
  title: string;                 // "Write email to Frederick"
  categoryId: CategoryId | null; // mapped to an existing category, or null → user picks
  honestEstimateMin: number | null; // from engine, once category known
  whenHint: string | null;       // raw datetime phrase if detected (Tier-1/2)
  rawTranscript: string;         // always kept; draft is editable
  source: VoiceStructuringSource;
}
```

One draft per task. Multi-task split (Pro) returns `ParsedTaskDraft[]`.

---

## 4. Packages (verify each via Context7 before install)

Install with `npx expo install` (Expo/RN deps), then `npx expo-doctor` (expect 18/18). Dev build only (Expo Go cannot run native modules — existing constraint).

| Package | Role | Context7 / source | Notes |
|---|---|---|---|
| `expo-speech-recognition` (jamsch) | On-device STT | `/jamsch/expo-speech-recognition` | Mature. Force `requiresOnDeviceRecognition`; guard with `supportsOnDeviceRecognition()`. |
| `react-native-apple-llm` (deveix) | Tier-2 on-device LLM | github.com/deveix/react-native-apple-llm | beta; iOS 26 + Apple Intelligence only. Gate on `isFoundationModelsEnabled()`. Alt: `@react-native-ai/apple` (Vercel AI SDK + Zod). |
| (custom Expo module) | Tier-1 NLTagger NER | Apple `NaturalLanguage` | No RN bridge exists → ~1 Swift file + config plugin. **Phase 4, optional.** |

Pin via Context7 `query-docs` for exact current API/props before writing the service wrappers — do not guess prop names.

---

## 5. Config & permissions (config plugins, not hand-edited native)

`ios/`/`android/` are gitignored (CNG) — configure in `app.json`, regenerate with `npx expo prebuild --clean`. Never set `ios.icon` to a `.icon` file.

```jsonc
// app.json → expo.plugins
["expo-speech-recognition", {
  "microphonePermission": "Whenbee uses the mic so you can speak a task instead of typing.",
  "speechRecognitionPermission": "Speech is transcribed on your device — it never leaves your phone."
}]
```

Request `requestPermissionsAsync()` at first mic tap (not on boot). Copy passes through `conversion-psychology` + `humanizer`; honor the no-guilt invariant and the brand voice ban-list ([[paywall-build-facts]]).

---

## 6. Structuring pipeline (the core)

`useVoiceCapture` orchestration, top-down (newspaper metaphor):

```ts
// 1. permission → 2. start on-device STT (partials shown live)
// 3. on final transcript → structure() → 4. produce draft(s) → 5. hand to composer (editable)

async function structure(transcript: string, categories: Category[]): Promise<ParsedTaskDraft> {
  if (await appleIntelligence.isAvailable()) {
    return appleIntelligence.toTaskDraft(transcript, categories); // Tier 2 — guided/structured output
  }
  return spokenTaskParser.toTaskDraft(transcript, categories);     // Tier 1 — pure rules (+ NER later)
}
```

- **Tier 2 (`appleIntelligence.ts`):** `AppleLLMSession` with instructions "rewrite into a short imperative task, start with a verb, ≤6 words" + `generateStructuredOutput({ verb, object, person, task, categoryId })`. Pass the user's existing categories so it picks a real one. `dispose()` after. Always `isFoundationModelsEnabled() === "available"` first; handle `"modelNotReady"` (downloading) by using Tier 1 that session.
- **Tier 1 (`spokenTaskParser.ts`, PURE):** strip preamble (`PREAMBLE_PATTERNS`: "I need to / I'd like to / remind me to / I was thinking about / can you …"), strip filler, trim, capitalize → imperative. Category via keyword→category map (`CATEGORY_KEYWORDS`). NER (person/datetime) added in Phase 4 via the NLTagger module.
- **Honest estimate:** once `categoryId` known, call the existing pure engine for the per-category honest number → `honestEstimateMin`. (Engine unchanged — reuse, don't duplicate.)

All thresholds/phrase lists live in `parserConstants.ts` (no magic strings/numbers — coding-standards).

---

## 7. UI & motion

- **Mic button** in the composer (`src/features/today` / planner composer). `Pressable` as a bare touch wrapper; visual on an inner `View` (reactCompiler + nativewind gotcha). Use `expo-image` for any glyph; native pressable, not TouchableOpacity.
- **Listening sheet:** live partial transcript + a mic-pulse animation. Reanimated, **transform/opacity only** (GPU props), `.get()/.set()` not `.value`. **Entering-only** animations — no `exiting` on conditionally-unmounted views (Fabric SIGABRT, [[reanimated-exiting-crash]]). Worklet helpers need `'worklet';` ([[reanimated-worklet-helper-crash]]).
- **Draft card:** title (editable), category chip, honest estimate, Save/Cancel. No guilt language, ever.
- **All spacing/size/font/color from `src/theme/tokens.ts`** via `useTheme()`. New token group → add a matching line in `resolveTheme` or `t.<key>` is undefined ([[usetheme-token-enumeration]]). Drive every design decision through `ui-design:react-native-design`; screenshot-verify on sim before "done"; founder approves UI from rendered screenshots only ([[visual-approval-workflow]]).
- Footer/sheet bottom adds `useSafeAreaInsets().bottom`.

---

## 8. Pro gating

Multi-task split + (later) hands-free + voice retro check the existing RevenueCat entitlement via the current provider/store — never hardcode pricing (invariant). Free flow (single task) never gated. Don't paywall raw dictation. Paywall copy through `conversion-psychology` + `humanizer`, no-guilt.

---

## 9. Phased delivery (each phase shippable, TDD on logic layers)

Process first: this is a feature → run `superpowers:brainstorming` already done via the eval; for each phase write tests first (engine/services/parser are logic-layer → TDD required).

- **Phase 1 — Pure parser (FREE, no native).** `spokenTaskParser` + `parserConstants` + `ParsedTaskDraft` type. TDD: preamble strip, filler, assembly, category-keyword map, edge cases. Wire engine honest-estimate lookup. *Ships value even before STT via a typed text box.*
- **Phase 2 — On-device STT (FREE).** `speechRecognition.ts` service (guarded), `useVoiceCapture` hook, mic button + listening sheet + draft card. End-to-end: speak → draft → edit → save. Tier 1 structuring. **This is the shippable free flow.**
- **Phase 3 — Tier 2 Apple LLM (FREE quality boost).** `appleIntelligence.ts` service + availability gating + structured output + fallback to Tier 1. Test on a real iOS 26 device.
- **Phase 4 — Tier 1 NER module (FREE quality boost).** Custom NLTagger Expo module (Swift + config plugin) for person/datetime on older devices.
- **Phase 5 — Multi-task split (PRO).** One utterance → `ParsedTaskDraft[]`; entitlement gate; review-all-drafts UI.
- **Later (separate plans):** hands-free Siri/widget (rides `WhenbeePresence`), voice retro, TTS speak-back.

---

## 10. Testing

- **Pure parser:** exhaustive Jest (TDD) — the cheap, high-value surface. Fixtures of real rambles → expected titles/categories.
- **Services:** unit-test with the native modules mocked (`isExpoGo` path + availability branches + fallback).
- **Hook:** test tiering decision + Pro gate + permission-denied path.
- **Engine:** unchanged; reuse existing honest-number tests.
- Run `npm run lint && npm run typecheck && npm test` before every commit; after editing specific files `npx eslint <files>`.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Accuracy (accents/noise/non-English) | On-device model; `contextualStrings` with contact names; result always editable; live partials. |
| Foundation Models device gating (iOS 26 + AI only) + beta | Gate on `isFoundationModelsEnabled()`; graceful Tier-1 fallback; never assume availability. |
| No RN bridge for NLTagger | Phase 4, optional; Tier 1 ships rules-only first. |
| Latency kills value | On-device only; stream partials; no network in core. |
| "Capture ≠ done" inbox death | Draft flows straight into composer/planner/estimate — Whenbee's advantage; don't build a dead note pile. |
| Public awkwardness / "I'd rather type" cohort | Voice always optional; typing stays first-class. |
| Privacy | On-device STT + on-device LLM; "your voice never leaves your phone" is the pitch. |
| Invariant violation | Hard rule: no cloud STT, no cloud LLM, no network in the guess→timer→learn loop. ESLint layer rules + isExpoGo guards. |

---

## 12. Mandatory skills per area (when building)

`react-native-architecture` + `react-native-expert` (screens/hooks/native), `vercel-react-native-skills` (perf/lists/animation props), `clean-code` + `coding-standards` + `software-architecture` (every file), `ui-design:react-native-design` (every design value), `creating-reanimated-animations` + `motion-design` (mic pulse/sheet), `conversion-psychology` + `humanizer` (all copy), `typescript-expert` (types/contracts). Context7 MCP for every package API lookup before writing wrappers.
