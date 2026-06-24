# Discoveries Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the two Discoveries surfaces — the hub card (a "featured nugget") and the full-list sheet (honey cards) — so the multiplier is the hero and discoveries read as honey, not generic indigo log rows.

**Architecture:** Pure display helpers derive everything from the existing `Discovery` fields (no engine/DB change). One small SVG `DiscoveryHex` renders the amber-`+` / green-`−` marker. `DiscoveriesGallery` and `DiscoveriesPreviewCard` are rewritten to consume the helpers + hex. All surfaces are the flat `surface` token — no glow, no border, no indigo edge.

**Tech Stack:** React Native (Expo SDK 54), TypeScript (strict), react-native-svg, Zustand (read-only here), Jest + @testing-library/react-native.

**Design spec:** `docs/superpowers/specs/2026-06-22-discoveries-redesign-design.md`
**Rendered mocks:** `docs/product/specs/mocks/13b-discoveries-fullcontext.html` (hub B = phone 2, list A = phone 3)

## Global Constraints

- **Tokens only** — never inline a raw hex/number. Every size/color/space comes from `src/theme/tokens.ts` via `useTheme()`. A genuinely new token is added to `tokens.ts` **and** `resolveTheme()` in `src/theme/useTheme.ts` (or `t.<key>` is undefined — the token-enumeration gotcha).
- **Direction coding:** `M >= 1` → **longer** → `colors.accent` (amber) + hex sign `+`; `M < 1` → **faster** → `colors.success` (green) + hex sign `−`. Direction must never rely on colour alone — the sign and the `LONGER`/`FASTER` word also carry it.
- **Flat surfaces:** discovery cards use `colors.surface` (matching the Your-areas + Pro cards), `radii.card`, no border, no shadow, no glow.
- **Copy baseline:** every proof/sentence speaks the canonical **15-minute** guess; the honest figure is `discovery.honestForFifteen`. No guilt language — "faster" is good news.
- **RN gotchas:** `Pressable` stays a bare touch wrapper (no function-form `style` — reactCompiler drops it); visual style goes on an inner `View`. No CSS `boxShadow` for depth. Entering-only animations (no `exiting` on Fabric).
- **Commits:** Conventional Commits, **no** `Co-Authored-By` / AI-attribution trailers. Use plain `git commit` (not the init-cmt skill — its interactive gate stalls subagents). Run `npm run lint` (0 warnings), `npm run typecheck`, `npm test` before each commit.

---

### Task 1: Discovery display helpers

Pure, framework-free string/branch logic — TDD. Also exports the shared `categoryLabel` (currently duplicated in `DiscoveriesGallery` and `WhenbeeHub`).

**Files:**
- Create: `src/features/whenbee/discoveryDisplay.ts`
- Test: `src/features/whenbee/__tests__/discoveryDisplay.test.ts`

**Interfaces:**
- Consumes: `CATEGORY_NAMES` from `@/src/engine`.
- Produces:
  - `type DiscoveryDirection = 'longer' | 'faster'`
  - `discoveryDirection(multiplier: number): DiscoveryDirection`
  - `multiplierValue(multiplier: number): string` — e.g. `"1.6"` (no `×`)
  - `dirLabel(direction: DiscoveryDirection): string` — `"LONGER"` | `"FASTER"`
  - `discoveryProof(honestForFifteen: number, direction: DiscoveryDirection): string`
  - `discoverySentence(honestForFifteen: number, direction: DiscoveryDirection): string`
  - `categoryLabel(id: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/whenbee/__tests__/discoveryDisplay.test.ts
import {
  discoveryDirection,
  multiplierValue,
  dirLabel,
  discoveryProof,
  discoverySentence,
  categoryLabel,
} from '../discoveryDisplay';

test('direction: M >= 1 is longer, M < 1 is faster, M === 1 is longer', () => {
  expect(discoveryDirection(1.6)).toBe('longer');
  expect(discoveryDirection(2.3)).toBe('longer');
  expect(discoveryDirection(0.6)).toBe('faster');
  expect(discoveryDirection(1)).toBe('longer');
});

test('multiplierValue formats to one decimal, no times suffix', () => {
  expect(multiplierValue(1.6)).toBe('1.6');
  expect(multiplierValue(2)).toBe('2.0');
  expect(multiplierValue(0.6)).toBe('0.6');
});

test('dirLabel is the uppercase word', () => {
  expect(dirLabel('longer')).toBe('LONGER');
  expect(dirLabel('faster')).toBe('FASTER');
});

test('proof line uses the 15m baseline and the right verb', () => {
  expect(discoveryProof(24, 'longer')).toBe('You plan 15m · really runs ~24m');
  expect(discoveryProof(9, 'faster')).toBe('You plan 15m · really only ~9m');
});

test('featured sentence uses the 15m baseline and the right verb', () => {
  expect(discoverySentence(24, 'longer')).toBe(
    'You plan 15 minutes — it really takes about 24.',
  );
  expect(discoverySentence(9, 'faster')).toBe(
    'You plan 15 minutes — it really takes only about 9.',
  );
});

test('categoryLabel uses the seed map, else title-cases the slug', () => {
  expect(categoryLabel('admin')).toBe('Admin & email');
  expect(categoryLabel('deep_work')).toBe('Deep Work');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/discoveryDisplay.test.ts`
Expected: FAIL — `Cannot find module '../discoveryDisplay'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/whenbee/discoveryDisplay.ts
import { CATEGORY_NAMES } from '@/src/engine';

// ──────────────────────────────────────────────────────────────────────────────
// Discovery display helpers — pure presentation logic shared by the hub featured
// card and the full-list gallery. A discovery's direction (longer vs faster) and
// its plain-English proof all derive from the banked multiplier + honestForFifteen
// (the canonical 15-minute baseline). No guilt: "faster" is framed as good news.
// ──────────────────────────────────────────────────────────────────────────────

export type DiscoveryDirection = 'longer' | 'faster';

/** M ≥ 1 → runs longer than the 15m guess; M < 1 → runs faster. */
export function discoveryDirection(multiplier: number): DiscoveryDirection {
  return multiplier >= 1 ? 'longer' : 'faster';
}

/** "1.6" — one decimal, no × (the view renders the × as a smaller suffix). */
export function multiplierValue(multiplier: number): string {
  return multiplier.toFixed(1);
}

export function dirLabel(direction: DiscoveryDirection): string {
  return direction === 'longer' ? 'LONGER' : 'FASTER';
}

/** Gallery proof line, 15m baseline. */
export function discoveryProof(honestForFifteen: number, direction: DiscoveryDirection): string {
  return direction === 'longer'
    ? `You plan 15m · really runs ~${honestForFifteen}m`
    : `You plan 15m · really only ~${honestForFifteen}m`;
}

/** Hub featured sentence, 15m baseline. */
export function discoverySentence(honestForFifteen: number, direction: DiscoveryDirection): string {
  return direction === 'longer'
    ? `You plan 15 minutes — it really takes about ${honestForFifteen}.`
    : `You plan 15 minutes — it really takes only about ${honestForFifteen}.`;
}

/** Seed-name map, else title-case the slug ("deep_work" → "Deep Work"). */
export function categoryLabel(id: string): string {
  const seed = CATEGORY_NAMES[id];
  if (seed) return seed;
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/whenbee/__tests__/discoveryDisplay.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint + commit**

```bash
npx eslint src/features/whenbee/discoveryDisplay.ts src/features/whenbee/__tests__/discoveryDisplay.test.ts
git add src/features/whenbee/discoveryDisplay.ts src/features/whenbee/__tests__/discoveryDisplay.test.ts
git commit -m "feat(discoveries): add display helpers for direction, proof, labels"
```

---

### Task 2: `DiscoveryHex` marker + `discovery` token

The honey hexagon with the consistent sign: amber `+` (longer), green `−` (faster). Adds the one new token this redesign needs.

**Files:**
- Modify: `src/theme/tokens.ts` (add the `discovery` group)
- Modify: `src/theme/useTheme.ts:4-9` (expose `discovery` in `resolveTheme`)
- Create: `src/features/whenbee/DiscoveryHex.tsx`
- Test: `src/features/whenbee/__tests__/DiscoveryHex.test.tsx`

**Interfaces:**
- Consumes: `DiscoveryDirection` from `./discoveryDisplay`; `t.discovery.hex`, `t.colors.accent/accentSoft/success/successSoft`.
- Produces: `DiscoveryHex({ direction, size }: { direction: DiscoveryDirection; size: number })`.

- [ ] **Step 1: Add the token**

In `src/theme/tokens.ts`, add immediately after the `proTeaser` group (around line 457):

```ts
  // Discovery marker geometry — the honey-hex sign (amber + = runs longer, green
  // − = runs faster) on each gallery card. One size; consumed via t.discovery.hex.
  discovery: { hex: 30 },
```

- [ ] **Step 2: Expose it in the theme**

In `src/theme/useTheme.ts`, add `discovery: tokens.discovery,` to the object returned by `resolveTheme` (alongside `proTeaser: tokens.proTeaser`).

- [ ] **Step 3: Write the failing test**

```tsx
// src/features/whenbee/__tests__/DiscoveryHex.test.tsx
import { render } from '@testing-library/react-native';
import { DiscoveryHex } from '../DiscoveryHex';

test('renders for the longer direction', () => {
  const { toJSON } = render(<DiscoveryHex direction="longer" size={30} />);
  expect(toJSON()).toBeTruthy();
});

test('renders for the faster direction', () => {
  const { toJSON } = render(<DiscoveryHex direction="faster" size={30} />);
  expect(toJSON()).toBeTruthy();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/DiscoveryHex.test.tsx`
Expected: FAIL — `Cannot find module '../DiscoveryHex'`.

- [ ] **Step 5: Write the implementation**

```tsx
// src/features/whenbee/DiscoveryHex.tsx
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/src/theme/useTheme';
import type { DiscoveryDirection } from './discoveryDisplay';

// Flat-top honey hexagon (viewBox 30×30) with a centered sign:
//   longer → amber outline + amber "+"   (runs longer than you guess)
//   faster → green outline + green "−"    (runs faster — good news)
const HEX = 'M15 1.5 27 8.25v13.5L15 28.5 3 21.75V8.25z';
const PLUS = 'M15 10v10 M10 15h10';
const MINUS = 'M10 15h10';

export function DiscoveryHex({
  direction,
  size,
}: {
  direction: DiscoveryDirection;
  size: number;
}) {
  const t = useTheme();
  const longer = direction === 'longer';
  const stroke = longer ? t.colors.accent : t.colors.success;
  const fill = longer ? t.colors.accentSoft : t.colors.successSoft;
  const sign = longer ? PLUS : MINUS;

  return (
    <Svg width={size} height={size} viewBox="0 0 30 30">
      <Path d={HEX} fill={fill} stroke={stroke} strokeWidth={1.4} />
      <Path d={sign} stroke={stroke} strokeWidth={2.3} strokeLinecap="round" />
    </Svg>
  );
}
```

- [ ] **Step 6: Run test + typecheck to verify it passes**

Run: `npx jest src/features/whenbee/__tests__/DiscoveryHex.test.tsx`
Expected: PASS (2 tests).
Run: `npm run typecheck`
Expected: no errors (confirms `t.discovery.hex` resolves).

- [ ] **Step 7: Lint + commit**

```bash
npx eslint src/theme/tokens.ts src/theme/useTheme.ts src/features/whenbee/DiscoveryHex.tsx src/features/whenbee/__tests__/DiscoveryHex.test.tsx
git add src/theme/tokens.ts src/theme/useTheme.ts src/features/whenbee/DiscoveryHex.tsx src/features/whenbee/__tests__/DiscoveryHex.test.tsx
git commit -m "feat(discoveries): add DiscoveryHex marker and discovery token"
```

---

### Task 3: Full-list gallery → honey cards

Rewrite the gallery card to the honey-card layout (hex left · category + proof middle · multiplier hero right) and add the count sub-line on the sheet.

**Files:**
- Modify: `src/features/whenbee/DiscoveriesGallery.tsx` (replace `DiscoveryCard` + the local `categoryLabel`)
- Modify: `src/app/(modals)/discoveries.tsx` (add the count sub-line under the heading)
- Test: `src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx`

**Interfaces:**
- Consumes: `discoveryDirection`, `discoveryProof`, `multiplierValue`, `dirLabel`, `categoryLabel` from `./discoveryDisplay`; `DiscoveryHex` from `./DiscoveryHex`; `t.discovery.hex`.
- Produces: `DiscoveriesGallery({ discoveries }: { discoveries: Discovery[] })` (unchanged signature).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx
import { render } from '@testing-library/react-native';
import { DiscoveriesGallery } from '../DiscoveriesGallery';
import type { Discovery } from '@/src/domain/types';

function disc(over: Partial<Discovery>): Discovery {
  return {
    id: 'd1',
    categoryId: 'admin',
    multiplier: 1.6,
    honestForFifteen: 24,
    headline: 'ignored',
    discoveredAt: 1,
    ...over,
  };
}

test('a longer discovery shows category, proof, multiplier and LONGER', () => {
  const { getByText } = render(<DiscoveriesGallery discoveries={[disc({})]} />);
  expect(getByText('Admin & email')).toBeTruthy();
  expect(getByText('You plan 15m · really runs ~24m')).toBeTruthy();
  expect(getByText('1.6')).toBeTruthy();
  expect(getByText('LONGER')).toBeTruthy();
});

test('a faster discovery shows the only-verb proof and FASTER', () => {
  const { getByText } = render(
    <DiscoveriesGallery
      discoveries={[disc({ id: 'd2', categoryId: 'writing', multiplier: 0.6, honestForFifteen: 9 })]}
    />,
  );
  expect(getByText('You plan 15m · really only ~9m')).toBeTruthy();
  expect(getByText('FASTER')).toBeTruthy();
});

test('empty list renders the invitation, not a card', () => {
  const { getByText } = render(<DiscoveriesGallery discoveries={[]} />);
  expect(getByText(/Nothing here yet/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx`
Expected: FAIL — `getByText('You plan 15m · really runs ~24m')` not found (the old card renders the `headline`).

- [ ] **Step 3: Rewrite `DiscoveriesGallery.tsx`**

Replace the entire file with:

```tsx
import { memo } from 'react';
import { View, Text, FlatList, type ViewStyle, type TextStyle, type ListRenderItem } from 'react-native';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Discovery } from '@/src/domain/types';
import { DiscoveryHex } from './DiscoveryHex';
import {
  discoveryDirection,
  discoveryProof,
  multiplierValue,
  dirLabel,
  categoryLabel,
} from './discoveryDisplay';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesGallery — the full list of banked discoveries (newest first), as
// honey cards: a hex sign (amber + = longer, green − = faster), the category and
// a plain-15m-baseline proof, and the multiplier as the hero on the right.
//
// Flat surface (matches the hub's Your-areas / Pro cards) — no border, no indigo
// edge. Cards never expire or grey: a discovery is something you learned and that
// stays true. Empty state is an invitation, not a void.
// ──────────────────────────────────────────────────────────────────────────────

const DiscoveryCard = memo(function DiscoveryCard({ discovery }: { discovery: Discovery }) {
  const t = useTheme();
  const direction = discoveryDirection(discovery.multiplier);
  const tint = direction === 'longer' ? t.colors.accent : t.colors.success;

  const card: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[3],
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const meta: ViewStyle = { flex: 1, minWidth: 0 };
  const cat: TextStyle = { ...(type.heading as unknown as TextStyle), color: t.colors.ink };
  const proof: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };
  const mult: TextStyle = {
    ...(type.honestNumberMd as unknown as TextStyle),
    color: tint,
    textAlign: 'right',
  };
  const times: TextStyle = { ...mult, fontSize: t.fontSize.md, opacity: t.opacity.pressed };
  const dir: TextStyle = {
    ...(type.eyebrow as unknown as TextStyle),
    color: t.colors.inkFaint,
    textAlign: 'right',
    marginTop: t.space[0.5],
  };

  return (
    <View style={card}>
      <DiscoveryHex direction={direction} size={t.discovery.hex} />
      <View style={meta}>
        <Text style={cat}>{categoryLabel(discovery.categoryId)}</Text>
        <Text style={proof}>{discoveryProof(discovery.honestForFifteen, direction)}</Text>
      </View>
      <View>
        <Text style={mult}>
          {multiplierValue(discovery.multiplier)}
          <Text style={times}>×</Text>
        </Text>
        <Text style={dir}>{dirLabel(direction)}</Text>
      </View>
    </View>
  );
});

const keyExtractor = (d: Discovery): string => d.id;
const renderItem: ListRenderItem<Discovery> = ({ item }) => <DiscoveryCard discovery={item} />;

function Separator() {
  const t = useTheme();
  return <View style={{ height: t.space[3] }} />;
}

function EmptyState() {
  const t = useTheme();
  const wrap: ViewStyle = { paddingTop: t.space[8], gap: t.space[2] };
  const title: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const body: TextStyle = { ...(type.body as unknown as TextStyle), color: t.colors.inkSoft };
  return (
    <View style={wrap}>
      <Text style={title}>Nothing here yet — and that&apos;s fine.</Text>
      <Text style={body}>
        Discoveries show up as Whenbee learns your patterns, usually after about five logs in an area.
        Keep tracking and they&apos;ll start landing here.
      </Text>
    </View>
  );
}

export function DiscoveriesGallery({ discoveries }: { discoveries: Discovery[] }) {
  const t = useTheme();
  if (discoveries.length === 0) return <EmptyState />;

  return (
    <FlatList
      data={discoveries}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: t.space[4], paddingBottom: t.space[12] }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the count sub-line on the sheet**

In `src/app/(modals)/discoveries.tsx`, replace the header `View` block (lines 36-39) so a sub-line shows when there are discoveries:

```tsx
  const heading: TextStyle = { ...(type.subtitle as unknown as TextStyle), color: t.colors.ink };
  const sub: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkSoft, marginTop: t.space[1] };

  return (
    <Screen>
      <SheetGrabber />
      <View style={{ paddingTop: t.space[6], paddingBottom: t.space[4] }}>
        <Text style={heading}>Things you’ve learned</Text>
        {discoveries.length > 0 ? (
          <Text style={sub}>{discoveries.length} truths Whenbee found in your tracking</Text>
        ) : null}
      </View>
      <DiscoveriesGallery discoveries={discoveries} />
    </Screen>
  );
```

- [ ] **Step 6: Typecheck + lint + commit**

```bash
npm run typecheck
npx eslint src/features/whenbee/DiscoveriesGallery.tsx "src/app/(modals)/discoveries.tsx" src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx
git add src/features/whenbee/DiscoveriesGallery.tsx "src/app/(modals)/discoveries.tsx" src/features/whenbee/__tests__/DiscoveriesGallery.test.tsx
git commit -m "feat(discoveries): rebuild full-list gallery as honey cards"
```

---

### Task 4: Hub card → featured nugget

Rewrite `DiscoveriesPreviewCard` to the flat featured-nugget layout: latest discovery's multiplier as the hero (amber/green), the count pill, the plain sentence, a `+N more` + `See all` footer.

**Files:**
- Modify: `src/features/whenbee/DiscoveriesPreviewCard.tsx` (full rewrite)
- Test: `src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx`

**Interfaces:**
- Consumes: `discoveryDirection`, `discoverySentence`, `multiplierValue`, `categoryLabel` from `./discoveryDisplay`; `router` from `expo-router`; `Ionicons`.
- Produces: `DiscoveriesPreviewCard({ discoveries, discoveryCount }: { discoveries: Discovery[]; discoveryCount: number })` (unchanged signature).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx
import { render } from '@testing-library/react-native';
import { DiscoveriesPreviewCard } from '../DiscoveriesPreviewCard';
import type { Discovery } from '@/src/domain/types';

function disc(over: Partial<Discovery>): Discovery {
  return {
    id: 'd1',
    categoryId: 'getting_ready',
    multiplier: 2.3,
    honestForFifteen: 35,
    headline: 'ignored',
    discoveredAt: 2,
    ...over,
  };
}

test('features the latest discovery with count, multiplier and sentence', () => {
  const { getByText, queryByText } = render(
    <DiscoveriesPreviewCard discoveries={[disc({})]} discoveryCount={1} />,
  );
  expect(getByText('LATEST DISCOVERY')).toBeTruthy();
  expect(getByText('1 banked')).toBeTruthy();
  expect(getByText('2.3')).toBeTruthy();
  expect(getByText('Getting ready')).toBeTruthy();
  expect(getByText('You plan 15 minutes — it really takes about 35.')).toBeTruthy();
  expect(getByText('See all 1')).toBeTruthy();
  // single discovery → no "+N more"
  expect(queryByText(/more/)).toBeNull();
});

test('shows +N more when the count exceeds one', () => {
  const { getByText } = render(
    <DiscoveriesPreviewCard discoveries={[disc({})]} discoveryCount={3} />,
  );
  expect(getByText('+2 more')).toBeTruthy();
  expect(getByText('See all 3')).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx`
Expected: FAIL — `getByText('LATEST DISCOVERY')` not found (old card renders "DISCOVERIES").

- [ ] **Step 3: Rewrite `DiscoveriesPreviewCard.tsx`**

Replace the entire file with:

```tsx
import { Pressable, View, Text, type ViewStyle, type TextStyle } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/theme/useTheme';
import { type } from '@/src/theme/typography';
import type { Discovery } from '@/src/domain/types';
import {
  discoveryDirection,
  discoverySentence,
  multiplierValue,
  categoryLabel,
} from './discoveryDisplay';

// ──────────────────────────────────────────────────────────────────────────────
// DiscoveriesPreviewCard — the hub teaser into the full gallery. A flat "featured
// nugget": the newest discovery in focus (its multiplier the hero, amber if it
// runs longer / green if faster), the running count (only ever grows), and a tap
// into the gallery. Discoveries are banked self-knowledge, never a score to beat.
//
// Flat surface (matches the Your-areas / Pro cards below) — no glow, no border.
// Rendered only when discoveryCount > 0 (the parent gates).
// ──────────────────────────────────────────────────────────────────────────────

export function DiscoveriesPreviewCard({
  discoveries,
  discoveryCount,
}: {
  discoveries: Discovery[];
  discoveryCount: number;
}) {
  const t = useTheme();
  const latest = discoveries[0];
  if (!latest) return null;

  const direction = discoveryDirection(latest.multiplier);
  const tint = direction === 'longer' ? t.colors.accent : t.colors.success;
  const moreCount = discoveryCount - 1;

  function open() {
    router.push('/(modals)/discoveries');
  }

  const cardWrap: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.card,
    borderCurve: 'continuous',
    padding: t.space[4],
  };
  const eyebrowRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[2],
    marginBottom: t.space[3],
  };
  const eyebrowLab: TextStyle = { ...(type.eyebrow as unknown as TextStyle), color: t.colors.inkSoft };
  const pill: TextStyle = {
    ...(type.captionBold as unknown as TextStyle),
    color: t.colors.accent,
    backgroundColor: t.colors.accentSoft,
    marginLeft: 'auto',
    paddingHorizontal: t.space[2.5],
    paddingVertical: t.space[1],
    borderRadius: t.radii.full,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  };
  const heroN: TextStyle = {
    ...(type.honestNumberMd as unknown as TextStyle),
    color: tint,
    marginBottom: t.space[1],
  };
  const heroX: TextStyle = { ...heroN, fontSize: t.fontSize.md, opacity: t.opacity.pressed };
  const cat: TextStyle = { ...(type.bodyLg as unknown as TextStyle), color: t.colors.ink };
  const sentence: TextStyle = {
    ...(type.bodySm as unknown as TextStyle),
    color: t.colors.inkSoft,
    marginTop: t.space[0.5],
  };
  const footer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: t.space[3],
    paddingTop: t.space[3],
    borderTopWidth: t.borderWidth.thick,
    borderTopColor: t.colors.hairline,
  };
  const moreTxt: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.inkFaint };
  const seeAll: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: t.space[1] };
  const seeTxt: TextStyle = { ...(type.bodySm as unknown as TextStyle), color: t.colors.primary };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`See all ${discoveryCount} things you've learned`}
    >
      <View style={cardWrap}>
        <View style={eyebrowRow}>
          <Text style={eyebrowLab}>LATEST DISCOVERY</Text>
          <Text style={pill}>{discoveryCount} banked</Text>
        </View>

        <Text style={heroN}>
          {multiplierValue(latest.multiplier)}
          <Text style={heroX}>×</Text>
        </Text>
        <Text style={cat}>{categoryLabel(latest.categoryId)}</Text>
        <Text style={sentence}>{discoverySentence(latest.honestForFifteen, direction)}</Text>

        <View style={footer}>
          {moreCount > 0 ? <Text style={moreTxt}>+{moreCount} more</Text> : <View />}
          <View style={seeAll}>
            <Text style={seeTxt}>See all {discoveryCount}</Text>
            <Ionicons name="chevron-forward" size={t.iconSize.sm} color={t.colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npm run typecheck
npx eslint src/features/whenbee/DiscoveriesPreviewCard.tsx src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx
git add src/features/whenbee/DiscoveriesPreviewCard.tsx src/features/whenbee/__tests__/DiscoveriesPreviewCard.test.tsx
git commit -m "feat(discoveries): rebuild hub card as featured nugget"
```

---

### Task 5: Full verification + device check

Confirm the whole suite is green, the duplicate `categoryLabel` in `WhenbeeHub` can stand or be deduped, and the surfaces render correctly on the simulator.

**Files:**
- Modify (optional dedup): `src/features/whenbee/WhenbeeHub.tsx:42-50` — replace its local `categoryLabel` with an import from `./discoveryDisplay` if it is identical.

- [ ] **Step 1: Optional dedup of `categoryLabel`**

Open `src/features/whenbee/WhenbeeHub.tsx`. If its local `categoryLabel` (lines 42-50) is byte-identical to the one now in `discoveryDisplay.ts`, delete the local function and add `categoryLabel` to the existing import from `./discoveryDisplay` (or add a new import line). If it differs, leave it untouched. Do not change any other behavior.

- [ ] **Step 2: Run the full gate**

```bash
npm run lint
npm run typecheck
npm test
```

Expected: lint 0 warnings, typecheck clean, all tests pass (including the three new suites).

- [ ] **Step 3: Device verification**

Run `npm run ios`. On the Whenbee hub with ≥1 banked discovery, confirm:
- The Discoveries card is a flat featured nugget on the **surface** tone (same as the Your-areas + Pro cards), no glow/border, big amber-or-green multiplier, `N banked` pill, `+N more` + `See all N`.
- Open it → the sheet shows honey cards: hex `+`/`−`, category, 15m-baseline proof, multiplier hero, `LONGER`/`FASTER`.
- Toggle to **light** mode and re-check both surfaces.
- A category that runs faster (`M < 1`) shows **green `−`** and the "only ~Xm" / "takes only about X" copy.

To reset/seed data on the sim, see the gotchas in `CLAUDE.md` (delete `Documents/SQLite/...`, relaunch with `xcrun simctl`).

- [ ] **Step 4: Final commit (only if the dedup step changed a file)**

```bash
npx eslint src/features/whenbee/WhenbeeHub.tsx
git add src/features/whenbee/WhenbeeHub.tsx
git commit -m "refactor(discoveries): dedupe categoryLabel into discoveryDisplay"
```

---

## Self-Review

**Spec coverage:**
- §3 Hub B featured nugget → Task 4. §3 List A honey cards → Task 3. §3 direction colour+sign coding → helpers (Task 1) + DiscoveryHex (Task 2) + both views. §3 flat surface tone → Tasks 3/4 use `colors.surface`, no border. §4.3 DiscoveryHex → Task 2. §5 copy → Task 1 helpers (verbatim strings tested). §6 derivation, no engine/DB change → Task 1 derives from existing fields. §7 tokens → Task 2 adds `discovery.hex` + resolve; numeric role `honestNumberMd` reused. §8 motion → entering-only kept on the hub parent (no new motion added; press-scale intentionally omitted — the hub card is the only tappable surface and keeps the existing plain Pressable to avoid the function-style gotcha). §9 a11y → accessibilityRole/label on the hub card; sign + word carry direction; tabular-nums. §11 testing → boundary `M===1`, both directions, empty state all covered.
- Gap surfaced: spec §8 mentioned an optional press-scale; this plan deliberately omits it (documented above) — no functional gap.

**Placeholder scan:** No TBD/TODO; every code step shows full content; all commands have expected output.

**Type consistency:** `DiscoveryDirection` defined in Task 1, consumed by Tasks 2/3/4. `multiplierValue` returns `"1.6"` (no `×`) everywhere; views add the `×`. `categoryLabel`/`discoveryProof`/`discoverySentence`/`dirLabel` signatures match between definition (Task 1) and use (Tasks 3/4). `t.discovery.hex` added (Task 2) before first use (Task 3). Component prop shapes match the existing call sites in `WhenbeeHub` (`discoveries`, `discoveryCount`) and the modal route (`discoveries`).
