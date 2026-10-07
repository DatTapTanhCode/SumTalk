import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev`        -> http://localhost:5173 (API proxied to the backend on :8000)
// `npm run dev:https`  -> https://<LAN-IP>:5173 so a phone on the same Wi-Fi may use the microphone
export default defineConfig(({ mode }) => {
  const https = mode === 'https'
  return {
    plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
    server: {
      host: https ? true : 'localhost',
      port: 5173,
      proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
    },
  }
})
