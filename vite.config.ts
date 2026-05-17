import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/enricher': {
        target: 'http://localhost:8004',
        rewrite: (path) => path.replace(/^\/api\/enricher/, ''),
        changeOrigin: true,
      },
      '/api/rozetka': {
        target: 'http://localhost:8001',
        rewrite: (path) => path.replace(/^\/api\/rozetka/, ''),
        changeOrigin: true,
      },
      '/api/shops': {
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/api\/shops/, ''),
        changeOrigin: true,
      },
      '/api/serpapi': {
        target: 'https://serpapi.com',
        rewrite: (path) => path.replace(/^\/api\/serpapi/, ''),
        changeOrigin: true,
      },
      '/api/openrouter': {
        target: 'https://openrouter.ai',
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
        changeOrigin: true,
      },
      '/api/catalog': {
        target: 'http://localhost:8003',
        rewrite: (path) => path.replace(/^\/api\/catalog/, '/api'),
        changeOrigin: true,
      },
    },
  },
})