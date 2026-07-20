import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Guard: a formSheet screen must never scroll with a bare <ScrollView>.
//
// Android formSheets need `nestedScrollEnabled` on their scroll container or the
// sheet's BottomSheetBehavior finds no scrolling child and a downward drag
// dismisses the sheet instead of scrolling back up. The bug is invisible until a
// sheet's content grows past one screen, so it lands silently — hence a static
// guard rather than relying on someone remembering. Use <SheetScrollView>, which
// carries the prop. See src/components/SheetScrollView.tsx.
// ──────────────────────────────────────────────────────────────────────────────

const MODALS_DIR = join(__dirname, '..', '..', 'app', '(modals)');

// fullScreenModal presentations, not formSheets — no sheet behavior to fight, so a
// plain ScrollView is correct there. Keep in sync with src/app/_layout.tsx.
const FULL_SCREEN_MODALS = ['reward.tsx', 'pro-welcome.tsx', 'report.tsx'];

describe('formSheet scroll containers', () => {
  const sheetFiles = readdirSync(MODALS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .filter((f) => !FULL_SCREEN_MODALS.includes(f));

  it.each(sheetFiles)('%s does not scroll with a bare ScrollView', (file) => {
    const src = readFileSync(join(MODALS_DIR, file), 'utf8');
    expect(src).not.toMatch(/<ScrollView[\s>]/);
  });

  it('covers every sheet route (guard would silently pass on an empty dir)', () => {
    expect(sheetFiles.length).toBeGreaterThan(5);
  });
});
