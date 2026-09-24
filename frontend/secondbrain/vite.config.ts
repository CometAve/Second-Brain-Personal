import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react({
      jsxRuntime: 'automatic',
    }),
    svgr(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // 빌드 최적화 설정 (Lighthouse 캐시 효율성 개선)
  build: {
    rolldownOptions: {
      output: {
        // 해시된 파일명으로 장기 캐싱 지원
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
        // 벤더 청크 분리 (캐시 효율성 향상)
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /\/node_modules\/(?:react|react-dom|scheduler)\// },
            {
              name: 'router',
              test: /\/node_modules\/@tanstack\/(?:react-router|router-core|history)\//,
            },
          ],
        },
      },
    },
    // 프로덕션 빌드 최적화
    sourcemap: false,
  },
  define: {
    // Vue feature flags for @milkdown/crepe compatibility
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  server: {
    port: 5173,
  },
});
