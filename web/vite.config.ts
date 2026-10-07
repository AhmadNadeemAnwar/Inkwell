import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxying /api to the .NET host keeps the browser on one origin in development,
    // so there is no CORS preflight and cookies/headers behave the same as in production.
    proxy: {
      '/api': {
        target: 'http://localhost:5231',
        changeOrigin: true,
      },
      // In production /media/<id> is answered by the Worker, which keeps a copy at Cloudflare.
      // There is no Worker in development, so the picture is fetched straight from the API.
      '/media': {
        target: 'http://localhost:5231',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/media\//, '/api/v1/images/'),
      },
    },
  },
})
