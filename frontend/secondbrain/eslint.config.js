import js from '@eslint/js';
import globals from 'globals';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import tailwindcss from 'eslint-plugin-tailwindcss';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Global ignore patterns (마이그레이션: .eslintignore → ignores 속성)
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts', // TanStack Router 자동 생성 파일
  ]),

  // Config 파일들: default export 허용
  {
    files: ['*.config.{js,ts}'],
    rules: {
      // Config 파일은 도구(Vite, Tailwind 등)가 default export를 요구함
    },
  },

  // 소스 코드: 엄격한 규칙 적용
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
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'no-relative-import-paths': noRelativeImportPaths,
    },
    settings: {
      'react-x': {
        version: 'detect',
      },
      tailwindcss: {
        functions: ['cn', 'cva'],
        cssConfigPath: './src/index.css',
      },
    },
    rules: {
      // 기존 Hooks 검사 범위를 유지한다. Compiler 규칙 도입은 별도 작업이다.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 컴포넌트에서 별도로 import하거나 인라인으로 정의하는 실제 CSS 클래스.
      'tailwindcss/no-custom-classname': [
        'warn',
        {
          whitelist: [
            'custom-scrollbar',
            'note-editor',
            'glass-border',
            'logo-spinner-container',
            'logo-spinner',
          ],
        },
      ],

      // 절대 경로 강제 규칙 (같은 폴더 내에서도 절대 경로 사용)
      'no-relative-import-paths/no-relative-import-paths': [
        'error',
        { allowSameFolder: false, rootDir: 'src', prefix: '@' },
      ],

      // TypeScript 네이밍 컨벤션
      '@typescript-eslint/naming-convention': [
        'error',
        // 변수: camelCase, PascalCase, UPPER_CASE 허용
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        // 함수: camelCase, PascalCase 허용
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        // 타입 관련: PascalCase만 허용
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        // 인터페이스: "I" 접두사 금지 (Hungarian notation 방지)
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        // 타입 별칭: "T" 접두사 금지
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
          custom: {
            regex: '^T[A-Z]',
            match: false,
          },
        },
        // 타입 파라미터: "T" 단독 사용 금지
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: {
            regex: '^T$|^T[A-Z]',
            match: false,
          },
        },
      ],
    },
  },
  // Prettier와 충돌하는 ESLint 규칙 비활성화 (반드시 마지막에 위치)
  eslintConfigPrettier,
]);
