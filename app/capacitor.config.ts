import type { CapacitorConfig } from '@capacitor/cli'
// Optional: CAP_SERVER_URL=https://192.168.x.x:5173 npx cap sync  -> live-reload the shell from a dev server.
const config: CapacitorConfig = {
  appId: 'com.puttprint.app',
  appName: 'Putt Print',
  webDir: 'dist',
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: true } } : {}),
  plugins: { Geolocation: {} },
}
export default config
