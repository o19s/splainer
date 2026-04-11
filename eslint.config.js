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
      '.test-dist/**',
      '.tmp/**',
      'coverage/**',
      'solr-splainer-package/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['app/scripts/**/*.js'],
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
      // Core `no-unused-vars` does not treat `<Foo />` as a use of `Foo`.
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // warn: islands use ref-synced callbacks where deps are intentionally omitted.
      'react-hooks/exhaustive-deps': 'warn',
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
