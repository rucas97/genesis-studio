import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@genesis/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url)
      ),
      '@genesis/engines': fileURLToPath(
        new URL('../../packages/engines/src/index.ts', import.meta.url)
      ),
      '@genesis/ai': fileURLToPath(
        new URL('../../packages/ai/src/index.ts', import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    exclude: ['@genesis/shared', '@genesis/engines', '@genesis/ai'],
  },
  server: { port: 5173, open: true },
});
