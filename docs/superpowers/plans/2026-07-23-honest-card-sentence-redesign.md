# HonestSuggestionCard Sentence-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chunky number-stack layout of `HonestSuggestionCard` with the approved sentence-first design: one 16pt sentence with the value inline in amber, hairline divider, 12pt behavioral footer.

**Architecture:** Single component rewrite in `src/features/shared/HonestSuggestionCard.tsx` plus its test file. All gating logic (`showRange`, Pro entitlement, analytics) is untouched — only the presentation layer and copy change. Spec: `docs/product/specs/2026-07-23-honest-suggestion-card-sentence-redesign.md`.

**Tech Stack:** React Native (Expo SDK 54), TypeScript strict, Zustand (`useEntitlement`), Jest + @testing-library/react-native.

## Global Constraints

- Every style value comes from `useTheme()` tokens (`t.fontSize.*`, `t.space[*]`, `t.colors.*`, `t.fontWeight.*`, `t.lineHeight.*`, `t.letterSpacing.*`) — no raw numbers or hex except `StyleSheet.hairlineWidth` (established pattern for divider hairlines; the `borderWidth.hairline` token is 0 by design).
- Copy is FINAL — use the exact strings from the spec; do not reword.
- Conventional Commits; **NEVER add any AI/co-author attribution trailer** (project HARD RULE overrides all defaults).
- Commit with plain `git` commands (do not invoke the interactive `/init-cmt` skill from a subagent).
- Do not touch `src/engine/**`, `add-task.tsx`, or the analytics event shape.
- Work happens in the dedicated git worktree directory given at dispatch — verify `git rev-parse --abbrev-ref HEAD` prints `feat/honest-card-sentence` before committing.

---

### Task 1: Rewrite tests + component (sentence-first)

**Files:**
- Modify: `src/features/shared/__tests__/HonestSuggestionCard.test.tsx` (full replace)
- Modify: `src/features/shared/HonestSuggestionCard.tsx` (full replace of styles/JSX; keep props, gating, analytics)

**Interfaces:**
- Consumes: `formatHonestMinutes(minutes)` from `@/src/lib/time` → `{ value: string; unit?: string }` (`{value:'25',unit:'min'}` under 60; `{value:'1h 35m'}` at/over 60 — no unit key).
- Produces: same exported `HonestSuggestionCard` component, identical props — no caller changes.

- [ ] **Step 1: Replace the test file with the new expectations**

Write `src/features/shared/__tests__/HonestSuggestionCard.test.tsx` with exactly:

```tsx
import { render, screen } from '@testing-library/react-native';
import { HonestSuggestionCard } from '@/src/features/shared/HonestSuggestionCard';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';

const NBSP = '\u00A0';

function setPro(isPro: boolean) {
  useEntitlement.setState({ isPro, ready: true });
}

afterEach(() => setPro(false));

describe('HonestSuggestionCard — pre-data (starting hunch)', () => {
  it('sentence-first: eyebrow, guess note, inline range value, dont-pad footer', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={35}
        guessMinutes={15}
        preEstimate
        range={{ lowMinutes: 25, highMinutes: 45 }}
      />,
    );
    expect(screen.getByText('A starting hunch')).toBeOnTheScreen();
    expect(screen.getByText('you guessed 15m')).toBeOnTheScreen();
    expect(screen.getByText(/Tasks like this usually land around/)).toBeOnTheScreen();
    expect(screen.getByText(`25–45${NBSP}min`)).toBeOnTheScreen();
    expect(
      screen.getByText('No need to pad your guess. This range does it for you. Sharpens as you log.'),
    ).toBeOnTheScreen();
    // Old chunky elements are gone.
    expect(screen.queryByText(/often run a bit longer/)).toBeNull();
    expect(screen.queryByText(/optimists like you/)).toBeNull();
    expect(screen.queryByText(/~/)).toBeNull();
  });

  it('falls back to the point value pre-data when no range is present', () => {
    render(<HonestSuggestionCard honestMinutes={35} guessMinutes={15} preEstimate />);
    expect(screen.getByText(`35${NBSP}min`)).toBeOnTheScreen();
  });
});

describe('HonestSuggestionCard — trained (usually, for you)', () => {
  it('folds provenance into the sentence and keeps the gut footer', () => {
    render(
      <HonestSuggestionCard honestMinutes={25} guessMinutes={15} categoryName="Email" />,
    );
    expect(screen.getByText('Usually, for you')).toBeOnTheScreen();
    expect(screen.getByText(/Your last few email tasks landed around/)).toBeOnTheScreen();
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(
      screen.getByText('Not a target, just what usually happens. Keep guessing with your gut.'),
    ).toBeOnTheScreen();
  });

  it('falls back to "similar" when no category name is given', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.getByText(/Your last few similar tasks landed around/)).toBeOnTheScreen();
  });

  it('formats hour-scale values in the sentence', () => {
    render(<HonestSuggestionCard honestMinutes={95} guessMinutes={60} />);
    expect(screen.getByText('1h 35m')).toBeOnTheScreen();
  });

  it('no legacy delta / arrow / locked-range affordance', () => {
    render(<HonestSuggestionCard honestMinutes={25} guessMinutes={15} />);
    expect(screen.queryByText('+10m')).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
    expect(screen.queryByText('→')).toBeNull();
  });
});

describe('HonestSuggestionCard — Pro-gated tightening range', () => {
  it('shows the range for Pro while the category is still learning', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
        categoryName="Email"
      />,
    );
    expect(screen.getByText(`20–30${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`25${NBSP}min`)).toBeNull();
  });

  it('shows the point (never the range numbers) to free users, no upsell', () => {
    setPro(false);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="setting"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`20–30${NBSP}min`)).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
  });

  it('keeps the point once the category has settled (honest), even for Pro', () => {
    setPro(true);
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        confidence="honest"
        range={{ lowMinutes: 20, highMinutes: 30 }}
      />,
    );
    expect(screen.getByText(`25${NBSP}min`)).toBeOnTheScreen();
    expect(screen.queryByText(`20–30${NBSP}min`)).toBeNull();
  });
});

describe('HonestSuggestionCard — reasonNote', () => {
  it('renders a quiet extra line when a Pro reasonNote is present', () => {
    render(
      <HonestSuggestionCard
        honestMinutes={25}
        guessMinutes={15}
        reasonNote="Afternoons run long"
      />,
    );
    expect(screen.getByText('Afternoons run long')).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run the test file — expect failures**

Run: `npx jest src/features/shared/__tests__/HonestSuggestionCard.test.tsx`
Expected: FAIL — new copy/NBSP strings not found (old layout still renders).

- [ ] **Step 3: Rewrite the component**

Replace `src/features/shared/HonestSuggestionCard.tsx` with exactly:

```tsx
import { useEffect, useRef } from 'react';
import { StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from '@/src/components/AppText';
import { useEntitlement } from '@/src/features/paywall/useEntitlement';
import { useTheme } from '@/src/theme/useTheme';
import { analytics } from '@/src/services/analytics';
import { formatHonestMinutes } from '@/src/lib/time';
import type { CalibrationConfidence, HonestRange } from '@/src/domain/types';

// ──────────────────────────────────────────────────────────────────────────────
// HonestSuggestionCard — the live calibration read (Add Task / live banners).
//
// This is a FORECAST, not a target. The honest number used to read as "set your
// wheel to this", so users dragged their own guess up to match it and the number
// chased them higher (15 → 30 → 60 …). The fix is presentation: a calm, read-only,
// past-tense description of what tasks like this tend to run — decoupled from the
// guess, with no arrow, no "+X more", no upsell.
//
// Sentence-first (2026-07-23 redesign): no display number. The value sits inline
// in one quiet sentence as an amber semibold span — the one honest thing on the
// sheet — with a hairline-divided footer carrying the behavioral reminder
// (pre-data: don't pad your guess; trained: not a target).
//
// Pre-data (a cold category on the population prior) shows a soft RANGE so it can
// never look like a precise 2× target. Once the model has data, free users see the
// single point; the tightening range stays a Pro payoff.
// ──────────────────────────────────────────────────────────────────────────────

// Keeps the value + unit ("25 min", "20–45 min") wrapping as one token.
const NBSP = '\u00A0';

export function HonestSuggestionCard({
  honestMinutes,
  guessMinutes,
  confidence,
  range,
  reasonNote,
  preEstimate,
  categoryName,
}: {
  honestMinutes: number;
  guessMinutes: number;
  /** OPTIONAL. Earned-Readiness of the category; drives the Pro range. */
  confidence?: CalibrationConfidence;
  /** OPTIONAL band the task tends to land in (low/high minutes). */
  range?: HonestRange | null;
  /** OPTIONAL Pro-only B15 note. Display-only — a quiet extra line; never changes
   *  the honest number. */
  reasonNote?: string;
  /** OPTIONAL. True while the estimate is still the population prior (cold category). */
  preEstimate?: boolean;
  /** OPTIONAL category name — grounds the sentence ("your last few X tasks"). */
  categoryName?: string;
}) {
  const t = useTheme();
  const isPro = useEntitlement((s) => s.isPro);

  // Pre-data everyone sees a soft range (never a precise target); post-data the
  // tightening range is a Pro payoff, free sees the point. A settled ('honest')
  // category resolves to a point for everyone.
  const showRange =
    range != null &&
    (preEstimate || (isPro && confidence !== undefined && confidence !== 'honest'));

  // Fire honest_range_shown once per distinct range the user looks at (debounced so
  // guess-dialing doesn't spam). Fire-and-forget; never throws into the loop.
  const lastShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showRange || range == null) return;
    const width = range.highMinutes - range.lowMinutes;
    const key = `${confidence ?? 'raw'}|${range.lowMinutes}|${range.highMinutes}|${isPro}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;
    analytics.capture('honest_range_shown', {
      surface: 'add_task',
      confidence: confidence ?? 'raw',
      width_min: Math.round(width / 5) * 5,
      is_pro: isPro,
    });
  }, [showRange, range, confidence, isPro]);

  // ── styles ──
  const card: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    paddingHorizontal: t.space[4],
    paddingVertical: t.space[4],
    gap: t.space[2],
  };
  const topRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  };
  const eyebrow: TextStyle = {
    fontSize: t.fontSize.xs,
    fontWeight: t.fontWeight.medium as TextStyle['fontWeight'],
    letterSpacing: t.letterSpacing.wide,
    textTransform: 'uppercase',
    color: t.colors.inkSoft,
  };
  const guessNote: TextStyle = { fontSize: t.fontSize.xs, color: t.colors.inkFaint };
  const sentence: TextStyle = {
    fontSize: t.fontSize.md,
    fontWeight: t.fontWeight.regular as TextStyle['fontWeight'],
    color: t.colors.ink,
    lineHeight: t.fontSize.md * t.lineHeight.normal,
  };
  const sentenceValue: TextStyle = {
    fontWeight: t.fontWeight.semibold as TextStyle['fontWeight'],
    color: t.colors.amberText,
    fontVariant: ['tabular-nums'],
  };
  const noteText: TextStyle = { fontSize: t.fontSize.sm, color: t.colors.inkSoft };
  const footer: TextStyle = {
    fontSize: t.fontSize.sm,
    color: t.colors.inkSoft,
    lineHeight: t.fontSize.sm * t.lineHeight.normal,
    marginTop: t.space[3],
    paddingTop: t.space[2.5],
    // A divider hairline (not a card border) — the borderWidth.hairline token is 0
    // in this borderless-card system, so use the platform hairline like InfoRow.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.hairline,
  };

  const formatted = formatHonestMinutes(honestMinutes);
  const pointValue = formatted.unit
    ? `${formatted.value}${NBSP}${formatted.unit}`
    : formatted.value;
  const valueText =
    showRange && range ? `${range.lowMinutes}–${range.highMinutes}${NBSP}min` : pointValue;

  const categoryLabel = categoryName?.toLowerCase() ?? 'similar';
  const sentenceLead = preEstimate
    ? 'Tasks like this usually land around '
    : `Your last few ${categoryLabel} tasks landed around `;
  const footerText = preEstimate
    ? 'No need to pad your guess. This range does it for you. Sharpens as you log.'
    : 'Not a target, just what usually happens. Keep guessing with your gut.';

  const spokenValue =
    showRange && range
      ? `${range.lowMinutes} to ${range.highMinutes} minutes`
      : `${honestMinutes} minutes`;
  const a11yLabel = preEstimate
    ? `Tasks like this usually land around ${spokenValue}. No need to pad your guess — this range does it for you.`
    : `Your last few ${categoryLabel} tasks usually land around ${spokenValue}. Not a target, just what usually happens.`;

  return (
    <View style={card} accessibilityLabel={a11yLabel}>
      <View style={topRow}>
        <AppText style={eyebrow}>{preEstimate ? 'A starting hunch' : 'Usually, for you'}</AppText>
        <AppText style={guessNote}>you guessed {guessMinutes}m</AppText>
      </View>

      <AppText style={sentence}>
        {sentenceLead}
        <AppText style={sentenceValue}>{valueText}</AppText>.
      </AppText>

      {reasonNote ? <AppText style={noteText}>{reasonNote}</AppText> : null}

      <AppText style={footer}>{footerText}</AppText>
    </View>
  );
}
```

- [ ] **Step 4: Run the test file — expect pass**

Run: `npx jest src/features/shared/__tests__/HonestSuggestionCard.test.tsx`
Expected: PASS (all tests). If the full-sentence `getByText` regex fails due to
nested-Text composition, match the lead text and the inner value span separately
(the inner `<AppText>` is its own queryable element) — do NOT change the JSX to
satisfy the test.

- [ ] **Step 5: Lint + typecheck the touched files**

Run: `npx eslint src/features/shared/HonestSuggestionCard.tsx src/features/shared/__tests__/HonestSuggestionCard.test.tsx && npm run typecheck`
Expected: zero errors/warnings.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: all suites pass (other suites don't render this card's copy, but verify).

- [ ] **Step 7: Commit**

```bash
git add src/features/shared/HonestSuggestionCard.tsx src/features/shared/__tests__/HonestSuggestionCard.test.tsx
git commit -m "feat(add-task): sentence-first honest suggestion card

Replaces the 32pt number stack with one quiet sentence (value inline in
amber) + hairline footer. Pre-data footer tells the user not to pad the
guess; trained footer keeps the not-a-target line. Gating, analytics and
props unchanged."
```

(No trailers of any kind.)
