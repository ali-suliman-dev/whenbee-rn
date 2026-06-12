const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

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
  { ignores: ['dist/*', '.expo/*', 'components/ui/**'] },
];
