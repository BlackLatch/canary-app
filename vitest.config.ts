import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '.next/',
        'out/',
      ],
      all: true,
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      }
    },
    // Add test timeout
    testTimeout: 10000,
    // Mock modules that have issues
    deps: {
      inline: ['helia', '@helia/unixfs']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})