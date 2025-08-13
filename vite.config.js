import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      // eslint-disable-next-line no-undef
      '@': path.resolve(__dirname, './src')
    }
  },
  // optional – adjust if you deploy under a sub-path
  base: '/',
  build: {
    sourcemap: true,
    outDir: 'dist'
  },
  server: {
    host: '0.0.0.0',
    port: 5173, // or any other port
  }
});

