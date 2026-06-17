# Task 7 Report — Static HoneyRing

## TDD Evidence

**RED:** Wrote `HoneyRing.test.tsx` first with two tests. Ran `npx jest` → FAIL: "Cannot find module '../HoneyRing'" (confirmed RED before any implementation).

**GREEN:** Created `HoneyRing.tsx`. First run failed because `accessibilityElementsHidden={true}` on the outer wrapper caused RNTL's `getByText` to return nothing (the accessibility tree was hidden). Fixed by removing those attributes — the outer container is not decorative; the SVG layer inside is the decorative element. Second run → both tests PASS.

## Hex Rendering

The wax-seal hex is a real SVG flat-top hexagon via `<Polygon>` inside the same `<Svg>` element. The `SealHex` helper computes 6 clockwise vertices:

- Top flat: `(cx, y)` → `(cx + w, y + h * 0.25)` → `(cx + w, y + h * 0.75)` → `(cx, y + h)` → `(cx - w/2, y + h * 0.75)` → `(cx - w/2, y + h * 0.25)`

Width = `t.seal.size`, height = `size * 1.1` (slightly taller than wide — correct flat-top proportions). No `PolygonSeal` wrapper — `SealHex` calls `<Polygon>` directly, keeping the code flat.

## Clean Code Confirmation

- No `display:'none'` placeholder View.
- No `sealStyle` ViewStyle (was only needed to avoid an unused-var error on the dead View — both removed together).
- No unused imports, no disabled lint rules.
- `accessibilityElementsHidden` removed (was from the brief's rough draft — it broke the test and is semantically wrong on the outer wrapper).
- Two named functions: `HoneyRing` (exported, the ring) and `SealHex` (private, the hex). Each does one thing.

## Fill Respects Endowed Floor

`pct = Math.max(t.ring.endowedPct, Math.min(100, sharpness))` — at `sharpness=0` the arc shows `endowedPct` (6%) not zero.

## Verification

- `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx` → 2/2 PASS
- `npm run typecheck` → clean (0 errors)
- `npx eslint src/features/whenbee/HoneyRing.tsx` → clean (0 warnings, 0 errors)
- `npm test` → 575 passed, 99 suites

## Files

- `src/features/whenbee/HoneyRing.tsx` (created)
- `src/features/whenbee/__tests__/HoneyRing.test.tsx` (created)
- `src/theme/useTheme.ts` (updated: added `ring`, `seal`, `mote` to resolveTheme return)

## Self-Review

- No dead code, no placeholders, no display:none.
- Hex is a genuine SVG Polygon — not a View approximation.
- All values from theme tokens (`t.ring.size`, `t.ring.stroke`, `t.ring.endowedPct`, `t.seal.size`, `t.colors.ringTrack`, `t.colors.accent`, `t.brand.bee.stripe`). Geometry math derived from tokens is fine per the constraint.
- No CSS `boxShadow`, no glow, flat-tactical.
- Arc starts at 12 o'clock via `<G rotation={-90}>`.

## Concerns

None. The `accessibilityElementsHidden` removal from the brief's draft is intentional — hiding the outer container's accessibility tree would also hide the bee children from assistive tech, which is wrong.

## Fix: a11y-hide scoped to SVG layer

Re-scoped accessibility-hide props (`accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"`) from the outer `<View style={wrap}>` to the SVG-layer View only (`<View style={svgAbsolute} pointerEvents="none">`) to hide the decorative ring from assistive tech while keeping the bee children and any text accessible.

**Verification:**
- `npx jest src/features/whenbee/__tests__/HoneyRing.test.tsx` → PASS (both tests: "renders its children (the bee slot)" + "mounts at the sealed state")
- `npx eslint src/features/whenbee/HoneyRing.tsx` → 0 warnings, 0 errors
- `npm run typecheck` → clean (0 errors)
