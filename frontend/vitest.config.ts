import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure-logic tests run in node. localStorage is stubbed in src/test/setup.ts.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
})
