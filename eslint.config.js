const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    // CLAUDE.md rule 3: no hardcoded colors outside the token file. Colors come
    // from theme.* / SEMANTIC.*; tints and washes from withAlpha(token, alpha).
    // Template literals built on a token (`rgba(${theme.glow.a},0.16)`) are fine.
    // An error, not a warning: every pre-existing violation has been removed.
    files: ['src/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['src/constants/theme.ts', 'src/constants/brandIcons.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Hardcoded hex color — use a theme/SEMANTIC token (CLAUDE.md rule 3).',
        },
        {
          selector: 'Literal[value=/rgba?\\(\\s*\\d/]',
          message: 'Hardcoded rgb(a) color — use withAlpha(token, alpha) (CLAUDE.md rule 3).',
        },
        {
          selector: 'TemplateElement[value.raw=/rgba?\\(\\s*\\d/]',
          message: 'Hardcoded rgb(a) color — use withAlpha(token, alpha) (CLAUDE.md rule 3).',
        },
        {
          selector: 'TemplateElement[tail=true][value.raw=/^[0-9a-fA-F]{2}$/]',
          message: 'Hex-alpha suffix on a color — use withAlpha(token, alpha) (CLAUDE.md rule 3).',
        },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'src/db/migrations/**',
      'src/constants/brandIcons.ts',
    ],
  },
]);
