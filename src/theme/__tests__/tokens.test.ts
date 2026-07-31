import { tokens } from '../tokens';
describe('design tokens', () => {
  it('exposes a numeric spacing scale that only grows by key', () => {
    // Keys include fractional micro-steps (0.5, 1.5), so order by numeric key —
    // JS object order would float non-integer keys to the end.
    const values = Object.entries(tokens.space)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
  });
  it('exposes light and dark color sets with identical keys', () => {
    // Order-independent: light and dark must expose the SAME keys, in any order.
    expect([...Object.keys(tokens.colors.light)].sort()).toEqual(
      [...Object.keys(tokens.colors.dark)].sort(),
    );
  });
  it('defines the core semantic colors', () => {
    for (const key of ['bg', 'surface', 'text', 'textMuted', 'primary', 'border'] as const)
      expect(tokens.colors.light[key]).toMatch(/^#|rgb/);
  });
  it('uses the indigo/amber/grass brand palette', () => {
    // bg (the page ground) is design-tuned, so assert only that it's a colour;
    // the brand anchors below are the invariant-relevant values and stay exact.
    expect(tokens.colors.light.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(tokens.colors.light.primary).toBe('#6B5BE6');
    expect(tokens.colors.light.accent).toBe('#EEAE4D');
    expect(tokens.colors.light.success).toBe('#33B07C');
  });
  it('exposes the indigoDeep/amberDeep tactile edge colors', () => {
    expect(tokens.colors.light.primaryEdge).toBe('#463B9E');
    expect(tokens.colors.light.accentEdge).toBe('#C68A30');
  });
});

describe('disabled control tokens', () => {
  it('exposes a disabled face, ink, and edge in both palettes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = tokens.colors[mode];
      expect(typeof c.controlDisabled).toBe('string');
      expect(typeof c.onControlDisabled).toBe('string');
      expect(typeof c.controlDisabledEdge).toBe('string');
    }
  });

  it('never reuses the live primary as the disabled face', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = tokens.colors[mode];
      expect(c.controlDisabled).not.toBe(c.primary);
    }
  });

  it('keeps light and dark key order identical', () => {
    expect(Object.keys(tokens.colors.light)).toEqual(Object.keys(tokens.colors.dark));
  });
});
