import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      '73e9b3c4c958.leopon-city.ts.net',
      '.leopon-city.ts.net',
      'dorothea-unwept-palatally.ngrok-free.app',
      '.ngrok-free.app',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
