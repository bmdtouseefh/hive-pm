import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    // NOTE: sync-server/*.json is rewritten on every sync POST. If Vite
    // watches it, each launch auto-sync triggers a full page reload, which
    // syncs again — an infinite reload loop in dev. Same for dist/ output.
    watch: { ignored: ['**/src-tauri/**', '**/sync-server/**', '**/dist/**'] },
  },
})
