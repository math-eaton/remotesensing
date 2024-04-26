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
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});