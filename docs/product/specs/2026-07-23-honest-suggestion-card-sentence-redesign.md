# HonestSuggestionCard — sentence-first redesign (approved 2026-07-23)

Founder-approved redesign of `src/features/shared/HonestSuggestionCard.tsx` (the
Add-Task "A starting hunch" / "Usually, for you" card). Approved from rendered
mocks (direction B of five) on 2026-07-23. Complaint driving it: the current
card's type is chunky and unrefined — 32pt bold number + 16pt semibold unit +
14pt semibold headline + bold eyebrow stack into four heavy elements.

## Direction

**Sentence-first.** The display number is removed entirely. The value (point or
range) lives inline inside one 16pt sentence as an amber semibold span. A
hairline divider separates a 12pt footer that carries the behavioral reminder.
Both card states share the shape.

## Layout (both states)

1. **Top row** (unchanged layout): eyebrow + guess note, `space-between`, baseline.
   - Eyebrow: `fontSize.xs` (10), **`fontWeight.medium`** (was bold), `letterSpacing.wide`,
     uppercase, `inkSoft`. Text: pre-data `A starting hunch`, post-data `Usually, for you`.
   - Guess note: unchanged — `fontSize.xs`, `inkFaint`, `you guessed {n}m`.
2. **Sentence**: `fontSize.md` (16), `fontWeight.regular`, `ink`,
   `lineHeight.normal`.
   - Inline value span: `fontWeight.semibold`, `amberText`, `fontVariant: ['tabular-nums']`,
     no tightened letterSpacing. The value must not wrap mid-token (keep the
     range + unit in one Text span so RN wraps it as a unit).
3. **Footer**: `fontSize.sm` (12), `inkSoft`, `lineHeight.normal`, top hairline
   divider (`StyleSheet.hairlineWidth`, `colors.hairline`), `marginTop: space[3]`,
   `paddingTop: space[2.5]`.

Card shell unchanged: `surface`, `radii.card`, `borderCurve continuous`,
padding `space[4]`, `gap: space[2]`, borderless.

**Removed:** the 32pt number row, the unit label, the pre-data headline
("Tasks like this often run a bit longer than they feel."), the provenance line,
the tilde prefix.

## Copy (final, humanized — do not reword)

Pre-data (`preEstimate`):
- Sentence: `Tasks like this usually land around {value}.`
- Footer: `No need to pad your guess. This range does it for you. Sharpens as you log.`

Post-data:
- Sentence: `Your last few {category} tasks landed around {value}.`
  (`{category}` = lowercased category name; fallback `similar` as today.)
- Footer: `Not a target, just what usually happens. Keep guessing with your gut.`

`{value}`:
- Range shown (same `showRange` logic as today): `{low}–{high} min` (en dash, no tilde).
- Point: `formatHonestMinutes` output joined with its unit (e.g. `25 min`, `1h 35m`).

## Behavior — unchanged

- `showRange` gating (pre-data everyone; post-data Pro-only while confidence
  isn't `honest`) — logic untouched.
- `honest_range_shown` analytics effect untouched.
- `reasonNote` prop stays supported: quiet `fontSize.sm` `inkSoft` line between
  sentence and footer (currently unused at the only call site).
- Props interface unchanged.

## Accessibility

- Pre-data range: `Tasks like this usually land around {low} to {high} minutes. No need to pad your guess — this range does it for you.`
- Post-data: `Your last few {category} tasks usually land around {value}. Not a target, just what usually happens.`

## Tests

Update `src/features/shared/__tests__/HonestSuggestionCard.test.tsx` to the new
copy/structure. Keep/port: showRange gating cases (free vs Pro vs preEstimate vs
settled), analytics debounce test, guess-note rendering. Add: footer copy per
state, inline value formatting (range vs point vs `1h 35m`).

## Invariants honored

- Forecast, never a target — no arrow, no upsell, decoupled from the guess.
- Amber only on the value span (`amberText` — AA in both modes).
- No guilt language. Pricing/Pro logic untouched.
