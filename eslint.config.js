const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
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
