import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './src/manifest.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const hostPermissions = [
    env.VITE_API_BASE_URL || 'http://localhost:8080',
    env.VITE_KG_API_BASE_URL || 'http://localhost:8000',
  ].map((baseUrl) => {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.hostname}/*`;
  });

  return {
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
      tailwindcss(),
      crx({
        manifest: { ...manifest, host_permissions: [...new Set(hostPermissions)] },
        contentScripts: {
          injectCss: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom/client',
        'webextension-polyfill',
        'react-markdown',
        'remark-gfm',
        'rehype-highlight',
      ],
      entries: [
        'src/content-scripts/overlay/overlay-entry.tsx',
        'src/background/service-worker.ts',
        'src/sidepanel/index.tsx',
      ],
    },
    build: {
      // Chrome Extension 크기 제한 고려 (압축 후 ~20MB)
      chunkSizeWarningLimit: 1000,
      // 빌드 타겟 명시
      target: 'esnext',
      minify: 'oxc',
      rolldownOptions: {
        output: {
          // 읽기 쉬운 청크 이름
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      // Source map 활성화 (디버깅용)
      sourcemap: true,
      modulePreload: false,
      cssCodeSplit: false,
    },
    server: {
      port: 5174,
      strictPort: true,
      hmr: {
        host: 'localhost',
        protocol: 'ws',
        port: 5174,
      },
    },
  };
});
