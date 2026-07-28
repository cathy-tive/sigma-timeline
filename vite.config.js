import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Sigma embeds the plugin in an iframe; base:'./' keeps asset URLs relative.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3002, headers: { 'Access-Control-Allow-Origin': '*' } },
})
