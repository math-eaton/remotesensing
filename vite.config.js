import { defineConfig } from 'vite';

export default defineConfig({
  // base: process.env.NODE_ENV === 'production' ? '/remotesensing/' : '/',
  base: './',
  // publicDir: 'public',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});