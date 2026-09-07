import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const THREE_PACKAGES = ['/three/', '@react-three/']

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Three.js and its React bindings dominate the bundle and change far
        // less often than the app code, so they get their own long-lived chunk
        // that survives an application redeploy in the browser cache.
        manualChunks(id: string) {
          if (THREE_PACKAGES.some((pkg) => id.includes(pkg))) return 'three'
          return undefined
        },
      },
    },
  },
})
