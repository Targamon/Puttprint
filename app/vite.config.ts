import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
// `npm run dev:https` sets HTTPS=1 -> self-signed cert so phones on the LAN get a secure context (required for GPS).
// /api is proxied to the Putt Print server so HTTPS pages don't hit mixed-content blocks.
const https = process.env.HTTPS === '1'
export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: { host: true, proxy: { '/api': { target: process.env.API_TARGET ?? 'http://localhost:8787', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } } },
})
