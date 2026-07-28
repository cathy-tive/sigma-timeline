import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'

// Build stamp shown in the corner of the plugin so you can confirm which code a
// Sigma workbook actually loaded. NOT a URL version — the plugin URL never changes.
const sha = (() => { try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'local' } })()
const now = new Date().toISOString().replace('T', ' ').slice(0, 16)
process.env.VITE_BUILD_STAMP = `${now}Z · ${sha}`
import react from '@vitejs/plugin-react'

// Sigma embeds the plugin in an iframe; base:'./' keeps asset URLs relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3002, headers: { 'Access-Control-Allow-Origin': '*' } },
})
