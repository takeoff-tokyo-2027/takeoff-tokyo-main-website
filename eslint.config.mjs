import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVariables = { argsIgnorePattern: '^_', caughtErrors: 'none' };

export default defineConfig([
  globalIgnores([
    '**/.*',
    'dist*/**',
    'build/**',
    'out/**',
    'coverage/**',
    'public/**',
    'assets/**',
    'supabase/**',
    'test-results/**',
    'playwright-report/**',
  ]),
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    extends: [js.configs.recommended],
    rules: { 'no-unused-vars': ['error', unusedVariables] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      // Existing API payloads use dynamic shapes; type tightening is a separate change.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedVariables],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'test/browser/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.{mjs,ts}', 'scripts/**/*.mjs', 'test/**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['functions/**/*.js', 'workers/**/*.js'],
    languageOptions: { globals: globals.worker },
  },
]);
