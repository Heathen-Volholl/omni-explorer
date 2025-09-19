import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.resolve(__dirname, '.');
const utilitiesDir = path.resolve(__dirname, 'utilities');

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
  optimizeDeps: {
    entries: ['index.html', 'index.tsx'],
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  server: {
    fs: {
      strict: true,
      deny: [utilitiesDir],
    },
  },
}));
