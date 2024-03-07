import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/remotesensing/' : '/',
  publicDir: 'public',
  root: './',
  build: {
    outDir: 'dist',
  },
  plugins: [
    eslint({
      cache: false,
      fix: true,
    }),
  ],
});