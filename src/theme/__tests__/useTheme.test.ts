import { resolveTheme } from '../useTheme';
import { tokens } from '../tokens';
describe('resolveTheme', () => {
  it('returns light colors for light mode', () => { expect(resolveTheme('light').colors.bg).toBe(tokens.colors.light.bg); });
  it('returns dark colors for dark mode', () => { expect(resolveTheme('dark').colors.bg).toBe(tokens.colors.dark.bg); });
  it('always exposes the shared scales', () => { expect(resolveTheme('light').space[4]).toBe(16); });
});
