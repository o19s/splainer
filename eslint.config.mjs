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
 * Pure-JS service modules under app/scripts/services/ (jsonEngineSettings.js, esSettings.js,
 * osSettings.js, solrSettings.js, splSearch.js, settingsStore.js, Search.js) are ESM (Vite
 * islands bundle); they
 * override sourceType for those paths.
 * Co-located Vitest specs (*.spec.js) in that folder import from vitest and those modules,
 * so they use sourceType: module as well.
 * Preact islands under app/scripts/islands/ are ESM (Vitest specs + Vite-built .jsx); they
 * override the classic-script rule for the rest of app/scripts. eslint-plugin-react is loaded
 * only for `react/jsx-uses-vars` so capitalized JSX tags count as variable uses for
 * `no-unused-vars` (core ESLint does not treat `<Foo />` as a reference to `Foo`).
 *
 * Parser ecmaVersion is 2018 so trailing commas in argument lists parse correctly.
 */
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
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
      // Vite IIFE output; not hand-edited source (see vite.islands.config.js).
      'app/scripts/islands/dist/**',
    ],
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
        // ES2020; not always present in eslint `globals.browser` for ecmaVersion 2018.
        globalThis: 'readonly',
        angular: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  {
    files: [
      'app/scripts/services/jsonEngineSettings.js',
      'app/scripts/services/esSettings.js',
      'app/scripts/services/osSettings.js',
      'app/scripts/services/solrSettings.js',
      'app/scripts/services/splSearch.js',
      'app/scripts/services/settingsStore.js',
      'app/scripts/services/Search.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
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
    files: ['app/scripts/services/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
    },
  },
  {
    files: ['app/scripts/islands/**/*.js', 'app/scripts/islands/**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-unused-vars': ['error', unusedVarsOptions],
      // Without this, components referenced only as JSX are falsely reported unused.
      'react/jsx-uses-vars': 'error',
      // rules-of-hooks is mechanically decidable; zero false positives → error.
      'react-hooks/rules-of-hooks': 'error',
      // exhaustive-deps stays as warn because PR 6's three-ref pattern
      // (onChangeRef updated via a no-deps useEffect) is intentionally
      // non-exhaustive. Warn-level keeps the lint visible without forcing
      // // eslint-disable graffiti at every imperative-library wrapper.
      'react-hooks/exhaustive-deps': 'warn',
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
        // ES2020; same as app/scripts block — wrapper specs assert SplainerServices on globalThis.
        globalThis: 'readonly',
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
    files: ['playwright.config.js', 'scripts/**/*.{js,mjs}'],
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
