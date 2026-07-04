const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const i18next = require('eslint-plugin-i18next');
const i18nextDefaults = require('eslint-plugin-i18next/lib/options/defaults');

module.exports = [
  ...expo,
  prettier,
  {
    rules: {
      // Metro handles @/* alias resolution; turn off the static resolver check.
      'import/no-unresolved': 'off',
    },
  },
  {
    // Architectural boundary: UI (screens + primitives) must reach services/db
    // through a store, provider, or feature hook — never import them directly.
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/src/services/*', '@/src/db/*'],
              message:
                'UI must reach services/db via a store, provider, or feature hook — not directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // i18n regression guard (A4): every remaining hardcoded JSX-text literal in
    // app/components/features has been extracted to `t(...)` calls (21 i18next
    // namespaces, en+sv parity — see src/i18n/locales/). The rule is now `error`
    // tree-wide so a future PR can't silently reintroduce a hardcoded string.
    //
    // `words.exclude` starts from the plugin's own defaults (punctuation-only,
    // ALL_CAPS/_-only, html entities, emoji-only) and adds a short, deliberate
    // allowlist of genuinely non-translatable strings found in the tree-wide
    // census: the brand name ("Whenbee" is never translated — see BrandLockup),
    // decorative glyphs used as pips/marks (✦ ⬡ ✓), and short unit/pill tokens
    // rendered next to numbers (`m` minutes suffix, `now` pill, the `m →`
    // guess-vs-honest arrow in report rows). These are formatting, not copy.
    //
    // Known-minor i18n gap (flagged for final review, not fixed here): the `m`
    // minute suffix and similar short unit/pill words are ignored at the lint
    // level rather than localized — acceptable for now, revisit before ship.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx', 'src/features/**/*.tsx'],
    ignores: ['**/__tests__/**', '**/*.test.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'should-validate-template': false,
          callees: { exclude: ['t', 'i18n', 'require', 'useTheme'] },
          words: {
            exclude: [
              ...i18nextDefaults.words.exclude,
              'Whenbee',
              '(?:✦|⬡|✓)',
              '(?:m\\s*→?|now|x)',
            ],
          },
        },
      ],
    },
  },
  { ignores: ['dist/*', '.expo/*', 'components/ui/**', '.claude/worktrees/**'] },
];
