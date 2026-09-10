import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    // Dev server only (`vite` / `vite preview`): skip the Host check so any
    // tailscale/ngrok/LAN hostname works without editing this list.
    // Production builds are unaffected (this option only applies to serve).
    allowedHosts:
      command === 'serve'
        ? true
        : [
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
}))
