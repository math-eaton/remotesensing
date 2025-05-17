import { defineConfig } from 'vite';
// import path from 'path';

export default defineConfig({
  base: '/remotesensing/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'tone': ['tone'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
