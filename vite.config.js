import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/remotesensing/' : '/',
  build: {
    rollupOptions: {
      input: './index.html',
      output: {
        manualChunks: {
          vendor: ['three', 'tone'], // Split these dependencies into a separate chunk
        },
      },
    },
  },
  resolve: {
    alias: {
      'three': path.resolve(__dirname, 'node_modules/three'),
    },
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
