import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  server: {
    host: '0.0.0.0',
    port: Number(loadEnv(mode, process.cwd(), '').DEV_PORT || 3000),
  },
  build: {
    outDir: 'build',
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'components/web-component.ts'),
      name: 'CanvasGrid',
      formats: ['es', 'umd'],
      fileName: format => (format === 'es' ? 'web-component.mjs' : 'web-component.js'),
    },
  },
}));
