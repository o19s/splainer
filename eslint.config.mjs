/**
 * ESLint flat config for Splainer (AngularJS 1.x, ES5 scripts).
 *
 * Aligned with splainer-search where it applies:
 * - `eslint:recommended` + `eslint-config-prettier`
 * - Same `no-unused-vars` options as splainer-search (.eslintrc.cjs)
 *
 * Splainer differs from splainer-search in language mode: app and tests are
 * classic scripts (not ESM), and tests use Jasmine + `inject`.
 */
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

const unusedVarsOptions = {
  vars: 'all',
  args: 'after-used',
  caughtErrors: 'all',
  ignoreRestSiblings: true,
  argsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.tmp/**',
      'coverage/**',
      'solr-splainer-package/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['Gruntfile.js', 'app/scripts/**/*.js', 'mockHelpers.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        angular: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jasmine,
        angular: 'readonly',
        inject: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  eslintConfigPrettier,
];
