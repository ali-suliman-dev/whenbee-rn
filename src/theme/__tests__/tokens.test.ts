import { tokens } from '../tokens';
describe('design tokens', () => {
  it('exposes a numeric spacing scale that only grows', () => {
    const values = Object.values(tokens.space);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
  });
  it('exposes light and dark color sets with identical keys', () => {
    expect(Object.keys(tokens.colors.light)).toEqual(Object.keys(tokens.colors.dark));
  });
  it('defines the core semantic colors', () => {
    for (const key of ['bg', 'surface', 'text', 'textMuted', 'primary', 'border'] as const)
      expect(tokens.colors.light[key]).toMatch(/^#|rgb/);
  });
});
