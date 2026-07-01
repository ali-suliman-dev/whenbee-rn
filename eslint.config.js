const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const i18next = require('eslint-plugin-i18next');

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
    // i18n regression guard (A3): wired for the string-extraction sweep (A4).
    // Rule is `off` here on purpose — the repo runs `eslint . --max-warnings=0`,
    // and turning this to `warn`/`error` globally today floods ~427 warnings
    // across every not-yet-extracted screen/component, which would fail CI on
    // untouched code. A4 flips this to `warn` (then `error`) PER SURFACE as each
    // directory's strings are extracted to `t(...)` calls — e.g. narrow `files`
    // to `src/features/today/**/*.tsx` once Today is done, and so on, until the
    // full `src/app/**`, `src/components/**`, `src/features/**` scope below is
    // clean, at which point this block's severity can go straight to `warn`.
    files: ['src/app/**/*.tsx', 'src/components/**/*.tsx', 'src/features/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'off',
        {
          mode: 'jsx-text-only',
          'should-validate-template': false,
          callees: { exclude: ['t', 'i18n', 'require', 'useTheme'] },
        },
      ],
    },
  },
  { ignores: ['dist/*', '.expo/*', 'components/ui/**', '.claude/worktrees/**'] },
];
