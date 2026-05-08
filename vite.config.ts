import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/buildcores': {
        target: 'http://localhost:8002',
        rewrite: (path) => path.replace(/^\/api\/buildcores/, ''),
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
    },
  },
})