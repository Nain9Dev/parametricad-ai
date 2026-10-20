import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { pwaOptions } from './pwa.config.ts'

const THREE_PACKAGES = ['/three/', '@react-three/', '/three-stdlib/']
const REACT_PACKAGES = ['/react/', '/react-dom/', '/scheduler/']

/**
 * Local ports reserved for this project: 5300 (dev) and 5301 (preview).
 *
 * `strictPort` is the part that matters. Left to itself Vite does not fail when
 * its port is taken, it increments and serves somewhere else without saying so.
 * Two projects then take turns owning `http://localhost:5173`, and whichever
 * wins inherits the other's `localStorage`, cookies and service worker, because
 * those belong to the origin rather than to the project. Failing to start is a
 * cheap, obvious signal; a silently borrowed session is neither.
 */
const DEV_PORT = 5300
const PREVIEW_PORT = 5301

export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: DEV_PORT,
    strictPort: true,
  },
  preview: {
    port: PREVIEW_PORT,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Three.js and its React bindings dominate the bundle and change far
        // less often than the app code, so they get their own long-lived chunk
        // that survives an application redeploy in the browser cache. React is
        // split out first: left to the heuristics it lands in the three chunk,
        // which then loads with the first paint instead of with the viewer.
        manualChunks(id: string) {
          if (REACT_PACKAGES.some((pkg) => id.includes(pkg))) return 'react'
          if (THREE_PACKAGES.some((pkg) => id.includes(pkg))) return 'three'
          return undefined
        },
      },
    },
  },
})
