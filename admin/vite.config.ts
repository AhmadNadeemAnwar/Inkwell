import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Same idea as the public site: in development /api goes to the local API, so there is no CORS.
    proxy: {
      '/api': { target: 'http://localhost:5231', changeOrigin: true },
    },
  },
})
