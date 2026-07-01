# Localization (i18n) + Multilingual, Android-Robust Voice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Whenbee fully translatable (English + Swedish, all ~900–1150 user-facing strings extracted to keys with locale-aware date/duration/number formatting) and make its already-built voice capture multilingual and reliable on **both** iOS and Android — including a clearly-consented network-STT fallback when on-device recognition is unavailable.

**Architecture:** Two related subsystems delivered in one plan.
**(A) Localization** stands up `i18next` + `react-i18next` + `expo-localization` detection behind a root provider, bundles per-locale JSON namespaces (no network — invariant-safe), and replaces every hardcoded string and `'en-US'`-hardcoded formatter with a keyed lookup / locale-aware `Intl` formatter. An ESLint `no-literal-string` rule + a key-parity test prevent regressions.
**(B) Voice** keeps the existing pure-parser → STT → Apple-LLM tiering but (1) drives the STT `lang` from the app locale, (2) replaces the device-level on-device gate with a **per-locale capability resolver** that prefers on-device, offers the Android offline-model download, and falls back to network recognition only after an explicit, localized, kv-persisted consent, (3) localizes the Tier-1 rules parser and the Tier-2 LLM instructions and the built-in category-keyword map per locale.

**Tech Stack:** Expo SDK 54, React Native 0.81.5 (Hermes), expo-router 6, TypeScript strict. New deps: `i18next`, `react-i18next`, `intl-pluralrules` (Hermes `Intl.PluralRules` polyfill), dev-only `eslint-plugin-i18next`. Existing (unchanged roles): `expo-localization`, `expo-speech-recognition`, `react-native-apple-llm`, `zustand`, `src/lib/kv.ts`.

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from `CLAUDE.md` / `AGENTS.md`.

- **Expo SDK 54 only.** Read `https://docs.expo.dev/versions/v54.0.0/`, never a newer URL. Install Expo/RN deps with `npx expo install <pkg>` (not `npm install`), then `npx expo-doctor` (expect 18/18). Pure-JS deps (`i18next`, `react-i18next`, `intl-pluralrules`, `eslint-plugin-i18next`) may use `npm install`.
- **Core-loop invariant:** No network call in the guess → timer → learn loop. i18n resources are **bundled JSON, imported statically — never fetched.** The engine (`src/engine/**`) stays pure (no i18n, no `Date`, no locale). **Network STT is NOT part of the calibration core loop** (calibration = the pure engine, still 100% on-device); it is an opt-in, consented, voice-only path and must be clearly disclosed.
- **No guilt, ever.** Amber never becomes red; no streaks/shame. Applies to every translated string in **every** language — the copyAudit guardrail runs across all locale JSON.
- **Honey/sharpness is monotonic.** Untouched by this work.
- **Pricing is read from RevenueCat**, never hardcoded. This plan gates nothing new behind Pro (voice free-flow stays free per locked Model B).
- **Every spacing/size/font/color value comes from a token in `src/theme/tokens.ts`** via `useTheme()`. New token → add to `tokens.ts` AND its matching line in `resolveTheme` (else `t.<key>` is undefined).
- **Every user-facing string comes from an i18n key** after this plan. No raw literals in JSX (ESLint-enforced).
- **Modal/sheet rule:** every `(modals)` route has `headerShown: false`; sheets start with `<SheetGrabber />`.
- **Animation rule:** no bounce/overshoot/translate-in on content; opacity/scale/path only; reduced-motion → final state.
- **Layer boundaries (ESLint):** `src/app/**` and `src/components/**` must not import `@/src/services/*` or `@/src/db/*` directly — route through a store/provider/feature hook. Routes stay thin.
- **Commits:** Conventional Commits. **NEVER** add `Co-Authored-By`, "Generated with Claude", 🤖, or any AI/co-author attribution. Use the `/init-cmt` skill interactively; a non-interactive subagent commits with plain `git`.
- **Git gates:** NEVER create a new branch without asking the founder first. NEVER merge (no `git merge`, no `gh pr merge`). Open the PR and stop.
- **Verify every change:** `npm run lint && npm run typecheck && npm test` before each commit; after editing specific files, `npx eslint <files>`. Device-verify voice on real iOS **and** Android hardware (simulator STT is unreliable) via the `whenbee-device` skill.
- **Out of scope (explicit):** RTL / bidi (no Arabic/Hebrew shipped) — do **not** add `I18nManager.forceRTL`, layout mirroring, or icon flips. Any language beyond `en` and `sv`. Remote/OTA translation loading.

---

## File Structure

New files (created by this plan):

```
src/i18n/
  index.ts                 # i18next init + configuration (single source; imported once at boot)
  detectLanguage.ts        # expo-localization → supported lang; reads kv override; pure-ish (guarded)
  languagePreference.ts    # get/set persisted language override in kv ('en' | 'sv' | 'system')
  format.ts                # locale-aware Intl formatters (date, weekday, monthDay, number) — hoisted
  useLocalizedFormat.ts    # hook exposing format.ts bound to the active i18n language
  formatDuration.ts        # PURE: minutes → parts; label via injected t (no hardcoded "h"/"m")
  resources.ts             # imports every namespace JSON for en + sv; builds the resources object
  i18next.d.ts             # module augmentation: types t() keys from the en resources shape
  locales/
    en/{common,onboarding,paywall,settings,today,addTask,timer,notifications,patterns,report,voice,errors}.json
    sv/{common,onboarding,paywall,settings,today,addTask,timer,notifications,patterns,report,voice,errors}.json
  __tests__/
    localeParity.test.ts   # every key present in every language; no empty values
    format.test.ts
    formatDuration.test.ts
    detectLanguage.test.ts

src/features/settings/LanguagePicker.tsx   # settings row + selection sheet (system/en/sv)

src/services/voice/recognitionCapability.ts   # PURE-ish resolver: locale → { requiresOnDevice, available, needsDownload, needsNetworkConsent }
src/services/voice/networkSttConsent.ts        # kv get/set per-locale network-STT consent
src/features/voice/parsing/parserLocales.ts    # per-locale PREAMBLE/FILLER/CLAUSE_SPLIT tables (en, sv)
src/features/voice/localeToStt.ts              # PURE: 'en' → 'en-US', 'sv' → 'sv-SE' (BCP-47 map)

src/components/voice/NetworkSttConsentSheet.tsx  # localized consent sheet before first network STT
```

Modified files:

```
src/app/_layout.tsx                     # mount I18nProvider + Suspense before the app tree
src/lib/time.ts                         # remove hardcoded "am/pm/h/m" from display helpers (delegate to formatDuration)
src/app/(tabs)/index.tsx                # replace toLocaleDateString('en-US', …) with localized format
src/features/today/calendarStrip/weekDays.ts   # localized weekday/month
src/features/report/buildReportHtml.ts  # localized month names + all report copy via t
src/lib/__tests__/copyAudit.test.ts     # scan locale JSON values (all langs), not JSX literals
src/services/voice/speechRecognition.ts # startSpeech({ lang, requiresOnDevice }); expose getSupportedLocales/download
src/features/voice/useVoiceCapture.ts   # resolve capability + consent, pass lang, drive mode
src/features/voice/parsing/spokenTaskParser.ts   # accept locale; pick locale table; raw-fallback for unknown
src/features/voice/parsing/parserConstants.ts    # re-export en table from parserLocales (keep back-compat) OR delete after migration
src/services/voice/spokenTaskStructurer.ts       # localize LLM instructions per locale
src/features/shared/categoryGuess.ts    # per-locale built-in keyword map; graceful null
app.json                                # expo.locales (Swedish app metadata) + expo-speech-recognition already present
eslint.config.js                        # add eslint-plugin-i18next no-literal-string (scoped)
package.json                            # new deps
```

---

## Subsystem A — Localization infrastructure + full extraction

### Task A1: Install i18n stack and prove the pipeline with English

**Files:**
- Modify: `package.json` (deps), `src/app/_layout.tsx`
- Create: `src/i18n/index.ts`, `src/i18n/resources.ts`, `src/i18n/detectLanguage.ts`, `src/i18n/languagePreference.ts`, `src/i18n/i18next.d.ts`, `src/i18n/locales/en/common.json`, `src/i18n/locales/sv/common.json`
- Test: `src/i18n/__tests__/detectLanguage.test.ts`

**Interfaces:**
- Produces: `initI18n(): Promise<void>` and default export `i18n` (i18next instance) from `src/i18n/index.ts`; `detectLanguage(): 'en' | 'sv'` from `detectLanguage.ts`; `getLanguagePreference(): 'system' | 'en' | 'sv'` / `setLanguagePreference(v): void` from `languagePreference.ts`; `SUPPORTED_LANGS = ['en','sv'] as const` and `type AppLang = 'en' | 'sv'` from `resources.ts`.
- Consumes: `src/lib/kv.ts` (`kv.getString`/`kv.set` — confirm the exact API by reading the file first).

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install i18next react-i18next intl-pluralrules
npm install --save-dev eslint-plugin-i18next
```
Expected: added to `package.json`. (Pure-JS packages — `npm install` is correct; not Expo native modules.) Then `npx expo-doctor` → expect 18/18 (no native change).

- [ ] **Step 2: Write the failing test for language detection**

Create `src/i18n/__tests__/detectLanguage.test.ts`:
```ts
import { detectLanguage } from '../detectLanguage';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'sv', languageTag: 'sv-SE' }]),
}));
jest.mock('../languagePreference', () => ({
  getLanguagePreference: jest.fn(() => 'system'),
}));

describe('detectLanguage', () => {
  it('returns the device language when supported and preference is system', () => {
    expect(detectLanguage()).toBe('sv');
  });

  it('falls back to en for an unsupported device language', () => {
    const { getLocales } = require('expo-localization');
    getLocales.mockReturnValueOnce([{ languageCode: 'de', languageTag: 'de-DE' }]);
    expect(detectLanguage()).toBe('en');
  });

  it('honors an explicit user override over the device language', () => {
    const { getLanguagePreference } = require('../languagePreference');
    getLanguagePreference.mockReturnValueOnce('en');
    expect(detectLanguage()).toBe('en');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/i18n/__tests__/detectLanguage.test.ts`
Expected: FAIL — "Cannot find module '../detectLanguage'".

- [ ] **Step 4: Create the resources, preference, and detector**

Create `src/i18n/resources.ts`:
```ts
import enCommon from './locales/en/common.json';
import svCommon from './locales/sv/common.json';
// NOTE: as each namespace is added in later tasks, import it here for both langs.

export const SUPPORTED_LANGS = ['en', 'sv'] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];
export const FALLBACK_LANG: AppLang = 'en';

export const resources = {
  en: { common: enCommon },
  sv: { common: svCommon },
} as const;

export const isSupportedLang = (v: string): v is AppLang =>
  (SUPPORTED_LANGS as readonly string[]).includes(v);
```

Create `src/i18n/languagePreference.ts` (read `src/lib/kv.ts` first to confirm method names; this assumes `kv.getString(key)` / `kv.set(key, value)`):
```ts
import { kv } from '@/src/lib/kv';
import { isSupportedLang, type AppLang } from './resources';

const KEY = 'settings.languageOverride';
export type LanguagePreference = 'system' | AppLang;

export const getLanguagePreference = (): LanguagePreference => {
  const raw = kv.getString(KEY);
  if (raw === 'system' || (raw != null && isSupportedLang(raw))) return raw;
  return 'system';
};

export const setLanguagePreference = (value: LanguagePreference): void => {
  kv.set(KEY, value);
};
```

Create `src/i18n/detectLanguage.ts`:
```ts
import { getLocales } from 'expo-localization';
import { FALLBACK_LANG, isSupportedLang, type AppLang } from './resources';
import { getLanguagePreference } from './languagePreference';

/** Active app language: explicit user override wins, else the device language if
 *  supported, else English. Never throws — expo-localization is native-guarded by
 *  its own JS shim, but a missing binary would return []. */
export const detectLanguage = (): AppLang => {
  const pref = getLanguagePreference();
  if (pref !== 'system') return pref;
  const deviceCode = getLocales()[0]?.languageCode ?? FALLBACK_LANG;
  return isSupportedLang(deviceCode) ? deviceCode : FALLBACK_LANG;
};
```

- [ ] **Step 5: Create the i18next init**

Create `src/i18n/index.ts`:
```ts
import 'intl-pluralrules'; // Hermes lacks Intl.PluralRules; polyfill before i18next init.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, FALLBACK_LANG, SUPPORTED_LANGS } from './resources';
import { detectLanguage } from './detectLanguage';

export const initI18n = async (): Promise<void> => {
  if (i18n.isInitialized) return;
  await i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANG,
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    defaultNS: 'common',
    ns: ['common'], // extend as namespaces are added.
    interpolation: { escapeValue: false }, // RN has no XSS; i18next default escapes.
    returnNull: false,
  });
};

export default i18n;
```

- [ ] **Step 6: Create the typed-keys augmentation**

Create `src/i18n/i18next.d.ts`:
```ts
import 'i18next';
import type common from './locales/en/common.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      // add each namespace here as it is created (Task A4).
    };
  }
}
```

- [ ] **Step 7: Seed the common namespace (English + Swedish)**

Create `src/i18n/locales/en/common.json`:
```json
{
  "save": "Save",
  "cancel": "Cancel",
  "done": "Done",
  "edit": "Edit",
  "delete": "Delete"
}
```
Create `src/i18n/locales/sv/common.json`:
```json
{
  "save": "Spara",
  "cancel": "Avbryt",
  "done": "Klar",
  "edit": "Redigera",
  "delete": "Ta bort"
}
```

- [ ] **Step 8: Run the detection test to verify it passes**

Run: `npx jest src/i18n/__tests__/detectLanguage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Mount the provider at the app root**

In `src/app/_layout.tsx`, import and initialize i18n before the tree renders. Read the current file first; the pattern (adapt to the existing boot/hydration gate — the app already has a boot spinner via `onboardingStore`, so hook `initI18n()` into that gate rather than adding a second spinner):
```tsx
import { I18nextProvider } from 'react-i18next';
import i18n, { initI18n } from '@/src/i18n';
// during boot effect: await initI18n();  (before flipping the "ready" flag)
// wrap the existing root tree:  <I18nextProvider i18n={i18n}>{tree}</I18nextProvider>
```
`initI18n()` is synchronous work wrapped in a resolved promise (bundled resources, no IO) — it will not add perceptible boot latency, and folding it into the existing hydration gate avoids a flash.

- [ ] **Step 10: Verify build + tests + lint**

Run: `npm run typecheck && npx jest src/i18n && npx eslint src/i18n src/app/_layout.tsx`
Expected: typecheck clean, tests PASS, eslint clean.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/i18n src/app/_layout.tsx
git commit -m "feat(i18n): stand up i18next + react-i18next with device detection and typed keys"
```

---

### Task A2: Locale-aware date / duration / number formatting

Replaces every hardcoded `'en-US'` formatter and the hardcoded `"h"/"m"/"am"/"pm"` display strings. The pure engine and `time.ts` numeric math stay pure; only the **display** label is localized.

**Files:**
- Create: `src/i18n/format.ts`, `src/i18n/useLocalizedFormat.ts`, `src/i18n/formatDuration.ts`, tests `src/i18n/__tests__/format.test.ts`, `src/i18n/__tests__/formatDuration.test.ts`
- Modify: `src/lib/time.ts` (`fmtHm`), `src/app/(tabs)/index.tsx`, `src/features/today/calendarStrip/weekDays.ts`
- Modify: `src/i18n/locales/{en,sv}/common.json` (duration units)

**Interfaces:**
- Produces: `makeFormatters(locale: string)` returning `{ weekdayShort(d: Date): string; monthDay(d: Date): string; number(n: number): string }` from `format.ts`; `useLocalizedFormat()` hook from `useLocalizedFormat.ts`; PURE `durationParts(totalMin: number): { h: number; m: number }` and `formatDuration(totalMin: number, t: TFunction): string` from `formatDuration.ts`.
- Consumes: i18n `t` and `i18n.language`.

- [ ] **Step 1: Write the failing formatter test**

Create `src/i18n/__tests__/format.test.ts`:
```ts
import { makeFormatters } from '../format';

describe('makeFormatters', () => {
  const d = new Date(2026, 0, 5); // Mon Jan 5 2026

  it('formats weekday + monthDay for en', () => {
    const f = makeFormatters('en-US');
    expect(f.weekdayShort(d)).toBe('Mon');
    expect(f.monthDay(d)).toBe('Jan 5');
  });

  it('formats weekday + monthDay for sv (different words)', () => {
    const f = makeFormatters('sv-SE');
    expect(f.weekdayShort(d).toLowerCase()).toContain('mån');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module '../format'`).

Run: `npx jest src/i18n/__tests__/format.test.ts`

- [ ] **Step 3: Implement hoisted locale-aware formatters**

Create `src/i18n/format.ts` (hoist `Intl.DateTimeFormat` per the `js-hoist-intl` perf rule — cache by locale, never construct in render):
```ts
type Formatters = {
  weekdayShort: (d: Date) => string;
  monthDay: (d: Date) => string;
  number: (n: number) => string;
};

const cache = new Map<string, Formatters>();

export const makeFormatters = (locale: string): Formatters => {
  const hit = cache.get(locale);
  if (hit) return hit;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const num = new Intl.NumberFormat(locale);
  const f: Formatters = {
    weekdayShort: (d) => weekday.format(d),
    monthDay: (d) => md.format(d),
    number: (n) => num.format(n),
  };
  cache.set(locale, f);
  return f;
};
```

Create `src/i18n/useLocalizedFormat.ts`:
```ts
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { makeFormatters } from './format';

const BCP47: Record<string, string> = { en: 'en-US', sv: 'sv-SE' };

export const useLocalizedFormat = () => {
  const { i18n } = useTranslation();
  const locale = BCP47[i18n.language] ?? 'en-US';
  return useMemo(() => makeFormatters(locale), [locale]);
};
```

- [ ] **Step 4: Run format test — expect PASS.**

Run: `npx jest src/i18n/__tests__/format.test.ts`

- [ ] **Step 5: Write the failing duration test**

Create `src/i18n/__tests__/formatDuration.test.ts`:
```ts
import { durationParts, formatDuration } from '../formatDuration';

const t = ((key: string, opts?: { count?: number }) => {
  const n = opts?.count ?? 0;
  if (key === 'common:duration.h') return `${n}h`;
  if (key === 'common:duration.m') return `${n}m`;
  return key;
}) as unknown as import('i18next').TFunction;

describe('formatDuration', () => {
  it('splits minutes into hours and minutes', () => {
    expect(durationParts(75)).toEqual({ h: 1, m: 15 });
    expect(durationParts(60)).toEqual({ h: 1, m: 0 });
    expect(durationParts(45)).toEqual({ h: 0, m: 45 });
  });

  it('formats via the injected translator (no hardcoded units)', () => {
    expect(formatDuration(75, t)).toBe('1h 15m');
    expect(formatDuration(60, t)).toBe('1h');
    expect(formatDuration(45, t)).toBe('45m');
    expect(formatDuration(0, t)).toBe('0m');
  });
});
```

- [ ] **Step 6: Run it — expect FAIL.**

Run: `npx jest src/i18n/__tests__/formatDuration.test.ts`

- [ ] **Step 7: Implement pure duration formatter**

Create `src/i18n/formatDuration.ts`:
```ts
import type { TFunction } from 'i18next';

/** Split a minute count into whole hours + remainder minutes. PURE. */
export const durationParts = (totalMin: number): { h: number; m: number } => {
  const mins = Math.max(0, Math.round(totalMin));
  return { h: Math.floor(mins / 60), m: mins % 60 };
};

/** Localized compact duration ("1h 15m"). Unit words come from the translator,
 *  never hardcoded. Mirrors the old fmtHm() shape. */
export const formatDuration = (totalMin: number, t: TFunction): string => {
  const { h, m } = durationParts(totalMin);
  const hs = t('common:duration.h', { count: h });
  const ms = t('common:duration.m', { count: m });
  if (h > 0 && m > 0) return `${hs} ${ms}`;
  if (h > 0) return hs;
  return ms;
};
```

- [ ] **Step 8: Add duration units to common.json (both langs)**

Add to `src/i18n/locales/en/common.json`:
```json
"duration": { "h": "{{count}}h", "m": "{{count}}m" }
```
Add to `src/i18n/locales/sv/common.json`:
```json
"duration": { "h": "{{count}} tim", "m": "{{count}} min" }
```

- [ ] **Step 9: Run duration test — expect PASS.**

Run: `npx jest src/i18n/__tests__/formatDuration.test.ts`

- [ ] **Step 10: Migrate call sites off hardcoded locales**

- In `src/lib/time.ts`: keep `fmtHm` temporarily but mark it `@deprecated` in a comment pointing to `formatDuration`; convert its callers (find with `grep -rn 'fmtHm(' src`) to `useLocalizedFormat`-adjacent `formatDuration(mins, t)` where a component (has access to `t`); for any pure/non-React caller, pass `t` down. Do NOT localize inside `time.ts` (it must stay pure/React-free).
- In `src/app/(tabs)/index.tsx:54-55`: replace `date.toLocaleDateString('en-US', { weekday: 'short' })` and `{ month:'short', day:'numeric' }` with `const fmt = useLocalizedFormat(); fmt.weekdayShort(date); fmt.monthDay(date);`.
- In `src/features/today/calendarStrip/weekDays.ts:40`: this is a pure helper — thread a `locale`/formatters param in from the calling component (which uses `useLocalizedFormat`) rather than importing i18n into the pure file.

- [ ] **Step 11: Verify + commit**

Run: `npm run typecheck && npx jest src/i18n && npx eslint src/i18n src/lib/time.ts 'src/app/(tabs)/index.tsx' src/features/today/calendarStrip/weekDays.ts`
Expected: all clean/PASS.
```bash
git add src/i18n src/lib/time.ts 'src/app/(tabs)/index.tsx' src/features/today/calendarStrip/weekDays.ts
git commit -m "feat(i18n): locale-aware date/duration/number formatting; drop hardcoded en-US"
```

---

### Task A3: Regression guards — no-literal-string lint, key-parity test, cross-locale copy audit

Locks the door behind extraction so new hardcoded strings and missing translations fail CI.

**Files:**
- Modify: `eslint.config.js`, `src/lib/__tests__/copyAudit.test.ts`
- Create: `src/i18n/__tests__/localeParity.test.ts`

**Interfaces:**
- Consumes: `resources` from `src/i18n/resources.ts`.

- [ ] **Step 1: Write the failing locale-parity test**

Create `src/i18n/__tests__/localeParity.test.ts`:
```ts
import { resources, SUPPORTED_LANGS, FALLBACK_LANG } from '../resources';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object'
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

describe('locale parity', () => {
  const base = resources[FALLBACK_LANG];
  const namespaces = Object.keys(base);

  it.each(SUPPORTED_LANGS)('language %s has every namespace', (lang) => {
    expect(Object.keys(resources[lang]).sort()).toEqual(namespaces.sort());
  });

  it.each(SUPPORTED_LANGS)('language %s has every key with a non-empty value', (lang) => {
    for (const ns of namespaces) {
      const baseKeys = flatten(base[ns as keyof typeof base] as Record<string, unknown>).sort();
      const langNs = resources[lang][ns as keyof (typeof resources)[typeof lang]] as Record<string, unknown>;
      const langKeys = flatten(langNs).sort();
      expect(langKeys).toEqual(baseKeys); // same keys, no missing/extra
      for (const key of langKeys) {
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], langNs);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run it — expect PASS** (en + sv common are in parity from A1/A2). This test now guards every future namespace.

Run: `npx jest src/i18n/__tests__/localeParity.test.ts`

- [ ] **Step 3: Point the copy audit at locale JSON values**

Read `src/lib/__tests__/copyAudit.test.ts`. It currently scans source files for banned guilt/shame words. Extend it so its regex banlist also runs over **every string value in `resources` for every language** (so a guilt word in the Swedish translation fails too). Keep the existing source-scan; add a `describe('locale copy is guilt-free')` block iterating `SUPPORTED_LANGS` × flattened values against the same banned-pattern list already defined in the file.

- [ ] **Step 4: Run the copy audit — expect PASS.**

Run: `npx jest src/lib/__tests__/copyAudit.test.ts`

- [ ] **Step 5: Add the no-literal-string ESLint rule (scoped)**

In `eslint.config.js`, add `eslint-plugin-i18next` and enable `i18next/no-literal-string` **only** for `src/app/**`, `src/components/**`, `src/features/**` (`*.tsx`), with options to ignore non-UI literals:
```js
// import i18next from 'eslint-plugin-i18next';  // (flat-config shape — adapt to the file's existing structure)
{
  files: ['src/app/**/*.tsx', 'src/components/**/*.tsx', 'src/features/**/*.tsx'],
  plugins: { i18next },
  rules: {
    'i18next/no-literal-string': ['warn', {
      mode: 'jsx-text-only',
      'should-validate-template': false,
      callees: { exclude: ['t', 'i18n', 'require', 'useTheme'] },
    }],
  },
},
```
Start at `warn` (repo runs `--max-warnings=0`, so warnings still fail CI, but this lets the extraction tasks turn them off file-by-file without a red wall on day one). Read the existing `eslint.config.js` and match its flat-config array shape exactly.

- [ ] **Step 6: Verify + commit**

Run: `npx jest src/i18n/__tests__/localeParity.test.ts src/lib/__tests__/copyAudit.test.ts && npx eslint eslint.config.js`
Expected: PASS/clean.
```bash
git add eslint.config.js src/lib/__tests__/copyAudit.test.ts src/i18n/__tests__/localeParity.test.ts package.json package-lock.json
git commit -m "test(i18n): key-parity + cross-locale copy audit; enable no-literal-string lint"
```

---

### Task A4: Systematic string extraction (surface by surface)

This is the bulk-mechanical phase: move every hardcoded UI string into a namespace key. **Do it one surface per task-commit** — a reviewer can approve `settings` extraction independently of `paywall`. There are ~900–1150 strings; the procedure below is identical for each surface. **Do not attempt all surfaces in one commit.**

**Surfaces (each = one namespace = one sub-task/commit), in priority order:**

1. `onboarding` — `src/app/(onboarding)/**`, `src/features/onboarding/**`
2. `paywall` — paywall screens/components (find via `grep -rln 'RevenueCat\|Purchases\|Pro' src/features src/app`)
3. `settings` — `src/app/(tabs)/settings.tsx` + `src/features/settings/**` (also lands the LanguagePicker copy from Task A6)
4. `today` — `src/app/(tabs)/index.tsx`, `src/features/today/**`
5. `addTask` — `src/app/(modals)/add-task.tsx`, `src/features/add-task/**`
6. `timer` — timer screen + `src/features/timer/**`
7. `notifications` — `src/services/notifications*` user-facing bodies/titles (these run outside React — see Step 6)
8. `patterns` — `src/features/patterns/**` (+ the existing `src/components/ripening-pro/copy.ts` → fold into this namespace)
9. `report` — `src/features/report/**` (paired with Task A5's report-HTML localization)
10. `voice` — `src/components/voice/**`, `src/features/voice/**` UI copy (consent sheet copy lands in Subsystem B)
11. `errors` — every `Alert.alert(...)`, error/empty-state string across all of the above

**Per-surface procedure (repeat for each namespace `NS` above):**

**Files (per surface):**
- Create: `src/i18n/locales/en/NS.json`, `src/i18n/locales/sv/NS.json` (Swedish filled in Task A5 — for A4, seed sv with the English value as a placeholder ONLY if you run parity before A5; better: create both here and translate sv now while context is fresh)
- Modify: `src/i18n/resources.ts` (import + register NS for both langs), `src/i18n/i18next.d.ts` (add NS to the `resources` type), `src/i18n/index.ts` (`ns:` array), and every component file in the surface
- Modify: nothing in tests except parity picks it up automatically

- [ ] **Step 1: Inventory the surface's strings**

Run: `npx eslint <surface globs> --rule '{"i18next/no-literal-string":"error"}' -f json` (or read files) to list every literal. Also grep: `grep -rn '"[A-Z][a-z].*"' <surface dir>` and scan JSX text nodes + `Alert.alert` + `placeholder=` + `accessibilityLabel=`.

- [ ] **Step 2: Author the key catalog**

Create `src/i18n/locales/en/NS.json` with intention-revealing, hierarchical keys (`section.element` — e.g. `"resetProgress.confirmTitle"`), values = the exact current English copy. **Do not reword** during extraction (copy changes are a separate concern; keep this diff mechanical and reviewable). Every string a user reads that is *new* wording still passes `conversion-psychology` + `humanizer` + the no-guilt invariant — but pure moves keep the wording identical.

- [ ] **Step 3: Wire `useTranslation` in each component**

For each `.tsx` in the surface:
```tsx
import { useTranslation } from 'react-i18next';
// inside the component:
const { t } = useTranslation('NS');
// <Text>Make my whole day honest</Text>  →  <Text>{t('proUpsell.title')}</Text>
```
Interpolation: `t('key', { count, name })`. Plurals: i18next `_one`/`_other` suffixed keys. The `<Trans>` component only where a string wraps inline JSX (links/bold) — rare here.

- [ ] **Step 4: Register the namespace**

In `resources.ts` import `NS.json` for both langs and add to the `resources` object; in `i18next.d.ts` add `NS: typeof nsEn;`; in `index.ts` add `'NS'` to the `ns` array.

- [ ] **Step 5: Translate Swedish now (or defer to A5)**

Fill `src/i18n/locales/sv/NS.json` with Swedish (see Task A5 for the translation-quality bar). Doing it per-surface keeps context fresh and keeps the parity test green at every commit.

- [ ] **Step 6: Handle non-React strings (notifications)**

`src/services/notifications*` runs outside a component — no `useTranslation`. Use the raw i18n instance: `import i18n from '@/src/i18n'; i18n.t('notifications.reminderBody', { … })`. i18n is initialized at boot, so `i18n.t` is safe by the time a notification schedules. (This keeps the service layer boundary intact — it imports i18n, not a component hook.)

- [ ] **Step 7: Turn the lint rule to error for this surface**

Once the surface has zero literals, tighten its override in `eslint.config.js` from `warn` to `error` (or rely on the global `--max-warnings=0`). Confirm `npx eslint <surface globs>` is clean.

- [ ] **Step 8: Verify + commit (per surface)**

Run: `npm run typecheck && npx jest src/i18n && npx eslint <surface globs>`
```bash
git add src/i18n 'src/<surface files>'
git commit -m "refactor(i18n): extract NS strings to keyed catalog"
```

Repeat Steps 1–8 for all 11 surfaces. **Each surface is its own commit and its own reviewer gate.**

---

### Task A5: Swedish translation quality pass + full parity

If Swedish was filled per-surface in A4, this task is the consolidation/QA gate. If deferred, this is where every `sv/*.json` gets authored.

**Files:** all `src/i18n/locales/sv/*.json`; Test: `src/i18n/__tests__/localeParity.test.ts` (must be green).

- [ ] **Step 1:** For each namespace, translate every value to natural Swedish (not literal). Honor: no-guilt invariant (no "misslyckades", "lat", "missade" as shame), Whenbee brand voice, the `{{count}}`/`{{name}}` interpolation placeholders preserved exactly, plural `_one`/`_other` forms correct for Swedish (Swedish has 2 plural forms like English).
- [ ] **Step 2:** Run `npx jest src/i18n/__tests__/localeParity.test.ts` → PASS (proves no missing/empty keys).
- [ ] **Step 3:** Run `npx jest src/lib/__tests__/copyAudit.test.ts` → PASS (proves Swedish is guilt-free).
- [ ] **Step 4:** Device-verify: set the simulator/device language to Swedish, boot the app, spot-check onboarding → paywall → today → add-task → settings for truncation/overflow (Swedish is ~15–20% longer than English; watch fixed-width chips/buttons). Screenshot-verify per the visual-approval workflow.
- [ ] **Step 5: Commit** `feat(i18n): Swedish translations for all namespaces`.

---

### Task A6: Settings language picker (system / English / Svenska)

**Files:**
- Create: `src/features/settings/LanguagePicker.tsx`
- Modify: `src/app/(tabs)/settings.tsx` (add the row), `src/i18n/locales/{en,sv}/settings.json` (labels)
- Test: `src/features/settings/__tests__/LanguagePicker.test.tsx`

**Interfaces:**
- Consumes: `getLanguagePreference`/`setLanguagePreference` (A1), `i18n.changeLanguage`.

- [ ] **Step 1: Write the failing test** — selecting "Svenska" calls `setLanguagePreference('sv')` and `i18n.changeLanguage('sv')`; selecting "System" calls `setLanguagePreference('system')` and switches to the detected language.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `LanguagePicker`** — a settings row opening a `formSheet` (headerShown:false, `<SheetGrabber />`) with three options: `t('settings:language.system')`, `English`, `Svenska` (language names shown in their own language — do NOT translate "Svenska"). On select: `setLanguagePreference(v)` then `i18n.changeLanguage(v === 'system' ? detectLanguage() : v)`. All spacing/color from tokens; no bounce animation; one primary action.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5:** Wire the row into `settings.tsx`. Verify live switch on device (language changes without restart — react-i18next re-renders subscribers; confirm the calendar strip/durations update too via `useLocalizedFormat`'s dependency on `i18n.language`).
- [ ] **Step 6: Commit** `feat(settings): language picker (system/English/Svenska) with live switch`.

---

### Task A7: App-store locale metadata + report localization

**Files:** Modify `app.json`, `src/features/report/buildReportHtml.ts` (Test: existing report tests + a new locale test).

- [ ] **Step 1:** In `app.json`, add `"locales"` for store metadata if localizing the app name/description (read Expo SDK 54 localization docs; `expo.locales` maps lang → a strings file). Add `sv` app metadata. Do NOT change `ios.icon` (keep the PNG — `.icon` fails older Xcode). `ios/`/`android/` are CNG — regenerate with `npx expo prebuild --clean` if the config plugin requires it; never hand-edit native.
- [ ] **Step 2:** `buildReportHtml.ts` currently hardcodes month-name arrays (`['Jan','Feb',…]`) and English report copy. Thread the active `locale` + a `t`-bound catalog (namespace `report`) into `buildReportHtml`. Replace month arrays with `new Intl.DateTimeFormat(locale, { month:'short' }).format(date)`. Translate all report labels via `report.json`. Write a test asserting a Swedish locale produces Swedish month + labels.
- [ ] **Step 3:** Verify PDF export renders correctly in both languages (device: this is a **must-verify-before-submission** Pro feature). Commit `feat(i18n): localize PDF report (months + copy) and app store metadata`.

---

## Subsystem B — Multilingual, Android-robust voice

Prerequisite: Task A1 (i18n active, `detectLanguage`/`i18n.language` available).

### Task B1: Drive STT locale from the app language + per-locale capability resolver

Replaces the device-level on-device gate (the reason Android fails) with a per-locale resolver, and stops hardcoding `lang:'en-US'`.

**Files:**
- Create: `src/features/voice/localeToStt.ts`, `src/services/voice/recognitionCapability.ts`, tests `src/features/voice/__tests__/localeToStt.test.ts`, `src/services/voice/__tests__/recognitionCapability.test.ts`
- Modify: `src/services/voice/speechRecognition.ts`

**Interfaces:**
- Produces: PURE `appLangToSttLocale(lang: string): string` (`'en'→'en-US'`, `'sv'→'sv-SE'`, unknown→`'en-US'`) from `localeToStt.ts`; `resolveRecognitionCapability(sttLocale: string): Promise<RecognitionCapability>` from `recognitionCapability.ts` where
```ts
export interface RecognitionCapability {
  onDeviceAvailable: boolean;   // locale model installed & usable now
  canDownloadModel: boolean;    // Android: offline model downloadable
  platform: 'ios' | 'android' | 'unsupported';
}
```
- Modifies `startSpeech` signature to `startSpeech(handlers: SpeechHandlers, opts: { lang: string; requiresOnDevice: boolean }): SpeechSession`.
- Consumes: `expo-speech-recognition` `getSupportedLocales()` (returns `{ locales: string[]; installedLocales: string[] }`), `supportsOnDeviceRecognition()`, `androidTriggerOfflineModelDownload()`.

- [ ] **Step 1: Write the failing localeToStt test**

Create `src/features/voice/__tests__/localeToStt.test.ts`:
```ts
import { appLangToSttLocale } from '../localeToStt';

describe('appLangToSttLocale', () => {
  it('maps supported app languages to BCP-47 STT locales', () => {
    expect(appLangToSttLocale('en')).toBe('en-US');
    expect(appLangToSttLocale('sv')).toBe('sv-SE');
  });
  it('falls back to en-US for unknown languages', () => {
    expect(appLangToSttLocale('de')).toBe('en-US');
  });
});
```

- [ ] **Step 2: Run → FAIL.** `npx jest src/features/voice/__tests__/localeToStt.test.ts`

- [ ] **Step 3: Implement the map**

Create `src/features/voice/localeToStt.ts`:
```ts
// App language → BCP-47 STT locale. Extend alongside SUPPORTED_LANGS.
const STT_LOCALE: Record<string, string> = { en: 'en-US', sv: 'sv-SE' };
const DEFAULT_STT = 'en-US';

export const appLangToSttLocale = (lang: string): string =>
  STT_LOCALE[lang] ?? DEFAULT_STT;
```

- [ ] **Step 4: Run → PASS.**

- [ ] **Step 5: Write the failing capability-resolver test**

Create `src/services/voice/__tests__/recognitionCapability.test.ts`. Mock the module surface (extend `jest.setup.js` mock or mock inline):
```ts
jest.mock('../speechRecognition', () => ({
  getSupportedSpeechLocales: jest.fn(),
  supportsOnDeviceSpeech: jest.fn(),
  speechPlatform: jest.fn(),
}));
import { resolveRecognitionCapability } from '../recognitionCapability';
import * as sr from '../speechRecognition';

describe('resolveRecognitionCapability', () => {
  it('iOS with the locale installed → on-device available', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('ios');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: ['en-US', 'sv-SE'], installedLocales: ['sv-SE'],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap).toEqual({ onDeviceAvailable: true, canDownloadModel: false, platform: 'ios' });
  });

  it('Android with the locale NOT installed but downloadable → needs download', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('android');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: ['sv-SE'], installedLocales: [],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap).toEqual({ onDeviceAvailable: false, canDownloadModel: true, platform: 'android' });
  });

  it('locale unsupported entirely → nothing on-device', async () => {
    (sr.speechPlatform as jest.Mock).mockReturnValue('android');
    (sr.supportsOnDeviceSpeech as jest.Mock).mockReturnValue(true);
    (sr.getSupportedSpeechLocales as jest.Mock).mockResolvedValue({
      locales: [], installedLocales: [],
    });
    const cap = await resolveRecognitionCapability('sv-SE');
    expect(cap.onDeviceAvailable).toBe(false);
    expect(cap.canDownloadModel).toBe(false);
  });
});
```

- [ ] **Step 6: Run → FAIL.**

- [ ] **Step 7: Extend `speechRecognition.ts` with the primitives**

In `src/services/voice/speechRecognition.ts` add (keeping the existing `requireOptionalNativeModule` guard and `isExpoGo` bail):
```ts
export const speechPlatform = (): 'ios' | 'android' | 'unsupported' => {
  if (isExpoGo || !ExpoSpeechRecognitionModule) return 'unsupported';
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'unsupported';
};

export interface SupportedSpeechLocales { locales: string[]; installedLocales: string[]; }

export const getSupportedSpeechLocales = async (): Promise<SupportedSpeechLocales> => {
  if (isExpoGo || !ExpoSpeechRecognitionModule) return { locales: [], installedLocales: [] };
  try {
    const r = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    return { locales: r.locales ?? [], installedLocales: r.installedLocales ?? [] };
  } catch {
    return { locales: [], installedLocales: [] };
  }
};

export const downloadOfflineModel = async (locale: string): Promise<boolean> => {
  if (isExpoGo || !ExpoSpeechRecognitionModule) return false;
  try {
    const r = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale });
    return r.status === 'download_success' || r.status === 'opened_dialog';
  } catch {
    return false;
  }
};
```
Add `import { Platform } from 'react-native';`. Verify the exact `getSupportedLocales`/`androidTriggerOfflineModelDownload` signatures against Context7 `/jamsch/expo-speech-recognition` before finalizing (the resolver is the single place these are called).

- [ ] **Step 8: Change `startSpeech` to accept `{ lang, requiresOnDevice }`**

Replace the hardcoded `start({ lang: 'en-US', … requiresOnDeviceRecognition: true … })` with the passed opts:
```ts
export const startSpeech = (
  handlers: SpeechHandlers,
  opts: { lang: string; requiresOnDevice: boolean },
): SpeechSession => {
  // …existing guard + listeners unchanged…
  speech.start({
    lang: opts.lang,
    interimResults: true,
    requiresOnDeviceRecognition: opts.requiresOnDevice,
    addsPunctuation: true,
    continuous: false,
  });
  // …
};
```

- [ ] **Step 9: Implement the resolver**

Create `src/services/voice/recognitionCapability.ts`:
```ts
import {
  getSupportedSpeechLocales,
  supportsOnDeviceSpeech,
  speechPlatform,
} from './speechRecognition';

export interface RecognitionCapability {
  onDeviceAvailable: boolean;
  canDownloadModel: boolean;
  platform: 'ios' | 'android' | 'unsupported';
}

/** Decide, for a concrete BCP-47 locale, whether on-device STT can run now,
 *  whether an offline model could be downloaded (Android), or whether the caller
 *  must fall back to consented network recognition. Never throws. */
export const resolveRecognitionCapability = async (
  sttLocale: string,
): Promise<RecognitionCapability> => {
  const platform = speechPlatform();
  if (platform === 'unsupported') {
    return { onDeviceAvailable: false, canDownloadModel: false, platform };
  }
  const deviceCanOnDevice = supportsOnDeviceSpeech();
  const { locales, installedLocales } = await getSupportedSpeechLocales();
  const installed = installedLocales.includes(sttLocale);
  const known = locales.includes(sttLocale);
  return {
    onDeviceAvailable: deviceCanOnDevice && installed,
    canDownloadModel: platform === 'android' && deviceCanOnDevice && known && !installed,
    platform,
  };
};
```

- [ ] **Step 10: Run capability tests → PASS.** `npx jest src/services/voice/__tests__/recognitionCapability.test.ts`

- [ ] **Step 11: Update existing callers of `startSpeech`**

`useVoiceCapture.ts` calls `startSpeech({...handlers})` today — it will fail typecheck until B2 rewires it. Temporarily pass `{ lang: 'en-US', requiresOnDevice: true }` to keep the build green, with a `// TODO(B2): resolve capability + locale` marker. Update `jest.setup.js` and `useVoiceCapture.test.ts` mocks to the new signature.

- [ ] **Step 12: Verify + commit**

Run: `npm run typecheck && npx jest src/features/voice src/services/voice && npx eslint src/services/voice src/features/voice/localeToStt.ts`
```bash
git add src/features/voice/localeToStt.ts src/services/voice/recognitionCapability.ts src/services/voice/speechRecognition.ts src/features/voice/useVoiceCapture.ts jest.setup.js src/features/voice/__tests__ src/services/voice/__tests__
git commit -m "feat(voice): per-locale STT capability resolver; parameterize lang + on-device mode"
```

---

### Task B2: Consented network-STT fallback + Android model download, wired into capture

Implements the founder decision: when on-device is unavailable, offer the Android offline download; else fall back to network recognition **only after an explicit, clear, localized, kv-persisted consent**.

**Files:**
- Create: `src/services/voice/networkSttConsent.ts`, `src/components/voice/NetworkSttConsentSheet.tsx`, tests
- Modify: `src/features/voice/useVoiceCapture.ts`, `src/i18n/locales/{en,sv}/voice.json`

**Interfaces:**
- Produces: `hasNetworkSttConsent(locale: string): boolean` / `grantNetworkSttConsent(locale: string): void` from `networkSttConsent.ts`.
- Consumes: B1's `resolveRecognitionCapability`, `downloadOfflineModel`, `appLangToSttLocale`, `i18n.language`.

- [ ] **Step 1: Write the failing consent-store test**

`src/services/voice/__tests__/networkSttConsent.test.ts`: granting for `sv-SE` makes `hasNetworkSttConsent('sv-SE')` true and leaves `en-US` false (consent is per-locale). Mock `@/src/lib/kv`.

- [ ] **Step 2: Run → FAIL. Step 3: Implement** (kv-backed, key `voice.networkSttConsent.<locale>`). **Step 4: Run → PASS.**

- [ ] **Step 5: Expand `VoiceStatus` + capture orchestration test**

Extend `useVoiceCapture.test.ts` for the new branches (mock `resolveRecognitionCapability`):
- on-device available → starts with `requiresOnDevice: true`, status `listening`.
- Android downloadable → status `needsDownload` (does not auto-start until download resolves).
- not on-device, no consent → status `needsNetworkConsent` (does NOT start recognition; waits for the sheet).
- not on-device, consent present → starts with `requiresOnDevice: false`.

Add to `VoiceStatus`: `'needsDownload' | 'needsNetworkConsent'`.

- [ ] **Step 6: Run → FAIL.**

- [ ] **Step 7: Rewrite `start()` in `useVoiceCapture.ts`**

```ts
import i18n from '@/src/i18n';
import { appLangToSttLocale } from './localeToStt';
import { resolveRecognitionCapability } from '@/src/services/voice/recognitionCapability';
import { hasNetworkSttConsent } from '@/src/services/voice/networkSttConsent';
import { downloadOfflineModel } from '@/src/services/voice/speechRecognition';

const start = useCallback(async () => {
  const sttLocale = appLangToSttLocale(i18n.language);
  const cap = await resolveRecognitionCapability(sttLocale);
  if (cap.platform === 'unsupported') { setStatus('unavailable'); return; }

  let requiresOnDevice = cap.onDeviceAvailable;
  if (!cap.onDeviceAvailable) {
    if (cap.canDownloadModel) { setStatus('needsDownload'); return; } // UI drives download, then retry
    if (!hasNetworkSttConsent(sttLocale)) { setStatus('needsNetworkConsent'); return; } // UI shows sheet
    requiresOnDevice = false; // consented network fallback
  }

  const granted = await requestSpeechPermission();
  if (!granted) { setStatus('denied'); return; }
  setPartial(''); setStatus('listening');
  sessionRef.current = startSpeech({ /* handlers unchanged */ }, { lang: sttLocale, requiresOnDevice });
}, [onDraft, stop]);
```
Add hook-returned actions: `confirmNetworkConsent()` (calls `grantNetworkSttConsent(sttLocale)` then re-invokes `start`), and `triggerDownload()` (calls `downloadOfflineModel(sttLocale)` then re-invokes `start`). Structure the transcript with the locale (Task B3): `structureSpokenTask(text, i18n.language)`.

- [ ] **Step 8: Run → PASS.**

- [ ] **Step 9: Build the consent sheet**

Create `src/components/voice/NetworkSttConsentSheet.tsx` — a `formSheet` (headerShown:false, `<SheetGrabber />`), copy from `voice.json`, no-guilt, honest: title `t('voice:networkConsent.title')`, body clearly stating words are sent to the OS speech provider (Apple/Google) to transcribe because offline isn't available for this language on this device, one primary "Use online recognition" + a secondary "Not now". Tokens for all styling; no bounce; opacity/scale only. English + Swedish values.
Also handle `needsDownload`: a lightweight prompt offering `t('voice:download.cta')` → `triggerDownload()`.

- [ ] **Step 10:** Wire both sheets where `useVoiceCapture` is consumed (`TaskTitleField.tsx` / listening flow) so `needsNetworkConsent` shows the consent sheet and `needsDownload` shows the download prompt.

- [ ] **Step 11: Verify + commit**

Run: `npm run typecheck && npx jest src/features/voice src/services/voice && npx eslint <changed files>`
```bash
git commit -m "feat(voice): consented network-STT fallback + Android offline-model download"
```

---

### Task B3: Localize the Tier-1 rules parser (per-locale phrase tables + raw fallback)

The English preamble/filler regex is useless in Swedish and would leave `"jag måste …"` in the title. Make the parser locale-aware; for a locale with no table, skip cleanup and keep the raw first clause (still editable — honest, never worse than the transcript).

**Files:**
- Create: `src/features/voice/parsing/parserLocales.ts`, test `src/features/voice/__tests__/parsing/parserLocales.test.ts`
- Modify: `src/features/voice/parsing/spokenTaskParser.ts`, `src/features/voice/parsing/parserConstants.ts`, `spokenTaskParser.test.ts`

**Interfaces:**
- Produces: `type ParserLocaleTable = { preamblePatterns: readonly RegExp[]; fillerWords: ReadonlySet<string>; clauseSplit: RegExp; maxTitleWords: number };` and `getParserTable(lang: string): ParserLocaleTable | null` from `parserLocales.ts`.
- Modifies: `parseSpokenTask(transcript: string, lang: string): ParsedTaskDraft`.

- [ ] **Step 1: Write the failing Swedish-parser test**

`parserLocales.test.ts` + additions to `spokenTaskParser.test.ts`:
```ts
import { parseSpokenTask } from '../../parsing/spokenTaskParser';

it('strips a Swedish preamble', () => {
  expect(parseSpokenTask('jag måste ringa tandläkaren', 'sv').title).toBe('Ringa tandläkaren');
});
it('drops Swedish filler', () => {
  expect(parseSpokenTask('eh typ boka bord', 'sv').title).toBe('Boka bord');
});
it('unknown locale keeps the raw first clause (no English rules applied)', () => {
  // must NOT strip "jag måste" using the English table
  expect(parseSpokenTask('jag måste ringa', 'de').title).toBe('Jag måste ringa');
});
it('still strips English preamble for en', () => {
  expect(parseSpokenTask('i need to email bob', 'en').title).toBe('Email bob');
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Build the locale tables**

Create `src/features/voice/parsing/parserLocales.ts` — move the existing English constants in as the `en` table, add `sv`:
```ts
export interface ParserLocaleTable {
  preamblePatterns: readonly RegExp[];
  fillerWords: ReadonlySet<string>;
  clauseSplit: RegExp;
  maxTitleWords: number;
}

const en: ParserLocaleTable = {
  preamblePatterns: [ /* the existing 6 English patterns from parserConstants.ts */ ],
  fillerWords: new Set(['um','uh','erm','like','basically','actually','just','really','kinda','sorta','maybe','somehow','literally']),
  clauseSplit: /\s+(?:then|and then|after that|also|plus)\s+/i,
  maxTitleWords: 8,
};

const sv: ParserLocaleTable = {
  preamblePatterns: [
    /^jag (?:måste|ska|behöver|vill|tänkte|borde|kommer att)\s+/i,
    /^(?:kan du |kom ihåg att |påminn mig att |påminn mig om att )\s*/i,
    /^(?:jag ska |jag måste )\s*/i,
    /^(?:min uppgift är|uppgift:|att göra:?|todo:?)\s+/i,
  ],
  fillerWords: new Set(['eh','öh','ehm','typ','liksom','alltså','bara','verkligen','kanske','asså']),
  clauseSplit: /\s+(?:sedan|och sedan|sen|efter det|också|plus)\s+/i,
  maxTitleWords: 8,
};

const TABLES: Record<string, ParserLocaleTable> = { en, sv };
export const getParserTable = (lang: string): ParserLocaleTable | null => TABLES[lang] ?? null;
```
Have `parserConstants.ts` re-export the `en` table's members for back-compat, or delete it and update imports.

- [ ] **Step 4: Make `parseSpokenTask` locale-aware**

```ts
export const parseSpokenTask = (transcript: string, lang: string): ParsedTaskDraft => {
  const table = getParserTable(lang);
  const raw = transcript.trim();
  if (!table) {
    // Unknown locale: no cleanup rules — keep the raw first clause, capitalized.
    return { title: capitalizeFirst(raw), rawTranscript: transcript, source: 'rules' };
  }
  const firstClause = raw.split(table.clauseSplit)[0] ?? '';
  const cleaned = dropFiller(stripPreamble(firstClause.trim(), table.preamblePatterns), table.fillerWords)
    .trim().split(/\s+/).slice(0, table.maxTitleWords).join(' ');
  return { title: capitalizeFirst(cleaned), rawTranscript: transcript, source: 'rules' };
};
```
Thread `patterns`/`fillerWords` params into the existing `stripPreamble`/`dropFiller` helpers (they currently close over the module constants).

- [ ] **Step 5: Run → PASS.**

- [ ] **Step 6: Update the caller** — `spokenTaskStructurer.ts` calls `parseSpokenTask(transcript, lang)` (lang passed from B2). **Step 7: Verify + commit** `feat(voice): locale-aware Tier-1 parser (en+sv, raw fallback for others)`.

---

### Task B4: Localize the Tier-2 Apple-LLM instructions per locale

Apple Foundation Models support Swedish (iOS 26.1+). Instruct it in the target language and to answer in the same language; keep the graceful Tier-1 fallback (also passes through B3 now).

**Files:** Modify `src/services/voice/spokenTaskStructurer.ts`, test `src/services/voice/__tests__/spokenTaskStructurer.test.ts`.

**Interfaces:** `structureSpokenTask(transcript: string, lang: string): Promise<ParsedTaskDraft>`.

- [ ] **Step 1: Write the failing test** — for `lang: 'sv'`, the LLM instructions passed to `getOnDeviceLlm().structure` are the Swedish instruction string; on empty/failed LLM result it falls back to `parseSpokenTask(transcript, 'sv')` (assert Swedish preamble stripping happens in fallback).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement per-locale instructions**
```ts
const INSTRUCTIONS: Record<string, string> = {
  en: 'Rewrite the user’s spoken note into a single short task. Start with a verb, imperative mood, at most 6 words, no preamble or filler. Return only the task title.',
  sv: 'Skriv om användarens talade anteckning till en kort uppgift. Börja med ett verb, imperativ, högst 6 ord, ingen inledning eller utfyllnad. Returnera endast uppgiftens titel.',
};
export const structureSpokenTask = async (transcript: string, lang: string): Promise<ParsedTaskDraft> => {
  const instructions = INSTRUCTIONS[lang] ?? INSTRUCTIONS.en;
  const llmResult = await getOnDeviceLlm().structure<{ title: string }>({ instructions, prompt: transcript, schema: { title: { type: 'string', description: 'The rewritten imperative task title' } } });
  const llmTitle = llmResult?.title?.trim() ?? '';
  if (llmTitle.length > 0) return { title: llmTitle, rawTranscript: transcript, source: 'appleLLM' };
  return parseSpokenTask(transcript, lang);
};
```
- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(voice): localize Tier-2 Apple LLM rewrite instructions (en+sv)`.

---

### Task B5: Localize the built-in category-keyword guesser

`categoryGuess.ts`'s built-in keyword tier is English; a Swedish title won't match any built-in category. Add a per-locale built-in keyword map; the learned + named-category tiers already work language-agnostically. Graceful: no match → return null (user picks), never a wrong guess.

**Files:** Modify `src/features/shared/categoryGuess.ts`, its test. (Read the file first — confirm the built-in keyword structure and the `guessCategory(title, { learned, namedCats, availableIds })` signature from the audit.)

- [ ] **Step 1: Write the failing test** — `guessCategory('ringa tandläkaren', { …, lang: 'sv' })` maps to the same built-in category id that `'call the dentist'` maps to in English; an unknown-locale title returns null rather than a mismatched English guess.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — extend the built-in keyword table to `Record<AppLang, Record<CategoryId, string[]>>` (or add a parallel `sv` table); add a `lang` param (default `'en'`) to `guessCategory`; select the table by lang; if the lang has no table, skip the built-in tier (fall through to null). Keep learned/named tiers unchanged. Thread `lang` from the caller (`useAddTask` → `i18n.language`).
- [ ] **Step 4: Run → PASS. Step 5: Commit** `feat(voice): locale-aware built-in category keyword guessing (en+sv)`.

---

### Task B6: Device verification matrix (iOS + Android, en + sv, on-device + fallback)

No new code — this is the sign-off gate. Use the `whenbee-device` skill to build Release on real hardware (simulator STT is unreliable).

- [ ] **iOS / English:** on-device STT works, Tier-2 rewrite fires (iOS 26 + Apple Intelligence on), title clean.
- [ ] **iOS / Swedish:** set app language Svenska; speak Swedish; confirm sv-SE transcription, Swedish LLM rewrite (or Swedish Tier-1 fallback if AI off), Swedish category guess.
- [ ] **iOS / Swedish, on-device sv-SE NOT installed:** confirm the consent sheet appears (Swedish copy) and network fallback transcribes after consent.
- [ ] **Android 14+ / English:** on-device model present or download prompt → transcribes.
- [ ] **Android / Swedish, model installed:** on-device sv-SE transcribes; Tier-1 Swedish parser cleans (no Apple LLM on Android — confirm Tier-1 path).
- [ ] **Android / Swedish, model absent, downloadable:** `needsDownload` prompt → download → retry → transcribes.
- [ ] **Android / Swedish, model absent, not downloadable:** consent sheet → network fallback transcribes after consent; declining leaves typing available.
- [ ] **Both platforms:** permission-denied path shows the localized denied state; typing always available (voice never forced).
- [ ] Record results in the PR description. Commit any copy/threshold fixes found; do not merge — open the PR and stop.

---

## Self-Review

**1. Spec coverage** (against the founder's three decisions + the two questions):
- *Translation, best approach* → Subsystem A: `i18next`+`react-i18next`+`expo-localization` (the Context7-verified standard Expo RN stack), bundled JSON (invariant-safe), typed keys, parity + no-literal-string guards. ✅
- *Full extraction (~900–1150 strings)* → Task A4 (11 surfaces) + A5 (Swedish) + A3 (guards). ✅
- *English + Swedish, no RTL* → RTL explicitly out of scope in Global Constraints; Swedish viability verified (Apple LLM 26.1+, runtime-probed STT). ✅
- *Voice per-language* → B1 (locale-driven `lang`), B3 (Tier-1 sv), B4 (Tier-2 sv), B5 (category sv). ✅
- *Does voice work on Android? / audit* → B1 resolver + B2 fallback directly fix the Android on-device fragility the audit found (forced on-device → failure); B6 verifies. ✅
- *Android network fallback with clear consent* → B2 (`NetworkSttConsentSheet`, per-locale kv consent, honest disclosure copy). ✅

**2. Placeholder scan:** No "TBD/handle-appropriately". The one non-enumerable part (the ~1000 individual string keys in A4) is deliberately a *repeatable procedure with a worked example*, not a placeholder — enumerating 1000 keys in a plan is neither possible nor useful; the per-surface procedure + parity test make each surface concretely checkable.

**3. Type consistency:** `AppLang`/`SUPPORTED_LANGS` (A1) reused throughout; `RecognitionCapability` (B1) consumed unchanged in B2; `parseSpokenTask(transcript, lang)` signature updated consistently across B3→B4 callers; `structureSpokenTask(transcript, lang)` threaded from B2. `startSpeech(handlers, { lang, requiresOnDevice })` new signature updated at its only caller (B1 Step 11, then B2 Step 7). `ParsedTaskDraft` unchanged (voice still emits title-only per the existing better-than-plan architecture).

**Assumptions to verify during execution (read the file, don't guess):** exact `src/lib/kv.ts` method names (`getString`/`set` assumed); exact `expo-speech-recognition` `getSupportedLocales`/`androidTriggerOfflineModelDownload` return shapes (verify via Context7 `/jamsch/expo-speech-recognition`); the `eslint.config.js` flat-config array shape; `categoryGuess.ts` built-in keyword structure; whether the root boot gate lives in `_layout.tsx` or `onboardingStore`.
