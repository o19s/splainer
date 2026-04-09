/**
 * ESLint flat config for Splainer (AngularJS 1.x, classic script syntax).
 *
 * Aligned with splainer-search where it applies:
 * - `eslint:recommended` + `eslint-config-prettier`
 * - Same `no-unused-vars` options as splainer-search (.eslintrc.cjs)
 *
 * Splainer differs from splainer-search in language mode: app and tests are
 * classic scripts (not ESM), and tests use Jasmine + `inject`. Test-only helpers
 * (e.g. under test/mock/) are linted together with specs via the test/ config block.
 * Playwright specs under e2e/ are ESM with Node + browser globals (callbacks run in the page).
 *
 * Parser ecmaVersion is 2018 so trailing commas in argument lists parse correctly.
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
    ignores: ['node_modules/**', 'dist/**', '.tmp/**', 'coverage/**', 'solr-splainer-package/**'],
  },
  js.configs.recommended,
  {
    files: ['Gruntfile.js', 'app/scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2018,
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
      ecmaVersion: 2018,
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
  {
    files: ['e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  // Root tooling configs (ESM): Node globals such as `process` for CI flags.
  {
    files: ['playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
];
