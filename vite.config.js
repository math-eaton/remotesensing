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
      // Proxy API requests to the Node.js server
      '/api': 'http://localhost:8080',
      //  other paths frontend needs to access from the Node.js server
      '/assets': 'http://localhost:8080',
    }
  }
});