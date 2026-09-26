import js from '@eslint/js';
import globals from 'globals';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import tailwindcss from 'eslint-plugin-tailwindcss';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      eslintReact.configs['recommended-typescript'],
      reactRefresh.configs.vite(),
      tailwindcss.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.webextensions, chrome: 'readonly' },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
      'no-relative-import-paths': noRelativeImportPaths,
    },
    settings: {
      'react-x': { version: 'detect' },
      tailwindcss: { functions: ['cn', 'cva'], cssConfigPath: './src/index.css' },
    },
    rules: {
      // 기존 Hooks 검사 범위를 유지한다. Compiler 규칙 도입은 별도 작업이다.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-relative-import-paths/no-relative-import-paths': [
        'warn',
        { allowSameFolder: true, rootDir: 'src', prefix: '@' },
      ],
    },
  },
  {
    files: ['src/content-scripts/overlay/**/*.{ts,tsx}'],
    settings: {
      tailwindcss: { functions: ['cn', 'cva'], cssConfigPath: './src/content-scripts/overlay.css' },
    },
    rules: {
      // The plugin reads the Tailwind theme but does not recognize this custom CSS selector.
      'tailwindcss/no-custom-classname': ['warn', { whitelist: ['extension-overlay-border'] }],
    },
  },
  {
    files: ['src/sidepanel/**/*.{ts,tsx}'],
    settings: {
      tailwindcss: {
        functions: ['cn', 'cva'],
        cssConfigPath: './src/sidepanel/styles/sidepanel.css',
      },
    },
    rules: {
      'tailwindcss/no-custom-classname': ['warn', { whitelist: ['scrollbar-custom'] }],
    },
  },
  {
    files: ['src/content-scripts/dragSearch/**/*.{ts,tsx}'],
    rules: {
      // These selectors live in the injected Shadow DOM stylesheet in drag-search-entry.tsx.
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          whitelist: [
            'scrollbar-custom',
            'floating-button',
            'action-button',
            'close-button',
            'icon',
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
]);
